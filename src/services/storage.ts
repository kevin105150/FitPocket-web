import { getTodayString } from '../utils/dateUtils';
import {
  CarbCycleType,
  CustomFood,
  DailyConfig,
  FoodRecord,
  FoodSearchResult,
  MealConfig,
  MealType,
  NutritionGoalPreset,
  UserProfile,
  WaterRecord,
  WeightRecord,
  WorkoutRecord,
} from '../types';
import presetFoodsData from '../data/presetFoods.json';
import {
  DEFAULT_EXERCISES,
  DEFAULT_MEALS,
  DEFAULT_MUSCLE_GROUPS,
  DEFAULT_PRESETS,
  DEFAULT_USER_PROFILE,
} from '../data/defaults';
import { auth, getAccessToken, loginWithGoogle } from '../lib/firebase';
import { DriveStorageService } from './driveStorage';
import { encryptApiKey, decryptApiKey } from '../utils/encryption';

import { dbGet, dbSet, dbKeys } from '../lib/db';

const STORAGE_KEYS = {
  FOOD_RECORDS: 'fitpocket_food_records',
  CUSTOM_FOODS: 'fitpocket_custom_foods',
  WATER_RECORDS: 'fitpocket_water_records',
  WATER_GOAL: 'fitpocket_water_goal',
  WATER_PRESETS: 'fitpocket_water_presets',
  WEIGHT_RECORDS: 'fitpocket_weight_records',
  WORKOUT_RECORDS: 'fitpocket_workout_records',
  CARB_PRESETS: 'fitpocket_carb_presets',
  ACTIVE_MEALS: 'fitpocket_active_meals',
  ACTIVE_CARB_CYCLE: 'fitpocket_active_carb_cycle',
  DAILY_CONFIGS: 'fitpocket_daily_configs',
  USER_PROFILE: 'fitpocket_user_profile',
  EXERCISES: 'fitpocket_exercises',
  MUSCLE_GROUPS: 'fitpocket_muscle_groups',
  CUSTOM_BODY_PARTS: 'fitpocket_custom_body_parts',
  GEMINI_KEY: 'fitpocket_gemini_key',
  GEMINI_MODEL: 'fitpocket_gemini_model',
  WORKOUT_PRESETS: 'fitpocket_workout_presets',
  MIGRATED: 'fitpocket_idb_migrated',
};

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'error' | 'offline';

// Simple pub/sub for sync status
const syncListeners: ((status: SyncStatus) => void)[] = [];
let currentSyncStatus: SyncStatus = localStorage.getItem('fitpocket_sync_pending') === 'true' ? 'pending' : 'synced';
let isSavingToDrive = false;
let hasPendingDriveSave = false;

function notifySyncStatus(status: SyncStatus) {
  currentSyncStatus = status;
  syncListeners.forEach(listener => listener(status));
}

// Memory cache for synchronous access
const memoryCache: Record<string, any> = {};

// Safe storage access
function getItem<T>(key: string, defaultValue: T): T {
  if (memoryCache[key] !== undefined) {
    return memoryCache[key] as T;
  }
  // Fallback to localStorage ONLY during initialization/migration
  try {
    const raw = localStorage.getItem(key);
    const value = raw ? (JSON.parse(raw) as T) : defaultValue;
    memoryCache[key] = value;
    return value;
  } catch (e) {
    console.warn(`Failed reading key ${key} from storage:`, e);
    return defaultValue;
  }
}

async function setItem<T>(key: string, value: T): Promise<void> {
  memoryCache[key] = value;
  try {
    // Save to IndexedDB asynchronously
    await dbSet(key, value);
    // Keep localStorage in sync for a short transition period or for critical flags
    if (key === 'fitpocket_sync_pending') {
       localStorage.setItem(key, JSON.stringify(value));
    }
  } catch (e) {
    console.warn(`Failed saving key ${key} to IndexedDB:`, e);
    // Critical fallback to localStorage if IndexedDB fails
    localStorage.setItem(key, JSON.stringify(value));
  }
}

export const StorageService = {
  async init(): Promise<void> {
    const isMigrated = localStorage.getItem(STORAGE_KEYS.MIGRATED) === 'true';
    
    if (!isMigrated) {
      console.log('Migrating localStorage data to IndexedDB...');
      // 1. Detect all relevant keys
      const keys = Object.values(STORAGE_KEYS);
      for (const key of keys) {
        if (key === STORAGE_KEYS.MIGRATED) continue;
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          try {
            const data = JSON.parse(raw);
            await dbSet(key, data);
            memoryCache[key] = data;
          } catch (e) {
            console.error(`Migration failed for key ${key}:`, e);
          }
        }
      }
      localStorage.setItem(STORAGE_KEYS.MIGRATED, 'true');
      console.log('Migration to IndexedDB completed successfully.');
    } else {
      // Load all keys from IndexedDB into memory cache
      console.log('Loading data from IndexedDB...');
      try {
        const keys = await dbKeys();
        for (const key of keys) {
          const val = await dbGet(key);
          memoryCache[key] = val;
        }
      } catch (e) {
        console.error('Failed to load data from IndexedDB:', e);
      }
    }
  },

  // Preset foods
  getPresetFoods(): FoodSearchResult[] {
    return (presetFoodsData as any[]).map((item) => {
      const isTfda = item.brand === '台灣衛福部基礎食材庫' || (item.id && item.id.startsWith('tfda_'));
      const defaultAmount = isTfda ? 100 : (item.defaultServingAmount || 100);
      const ratio = defaultAmount / 100;
      return {
        id: item.id,
        name: item.name,
        brand: item.brand || '一般食材',
        calories: Math.round(item.caloriesPer100g * ratio * 10) / 10,
        carbs: Math.round(item.carbsPer100g * ratio * 10) / 10,
        sugars: Math.round((item.sugarsPer100g || 0) * ratio * 10) / 10,
        fiber: Math.round((item.fiberPer100g || 0) * ratio * 10) / 10,
        protein: Math.round(item.proteinPer100g * ratio * 10) / 10,
        fat: Math.round(item.fatPer100g * ratio * 10) / 10,
        sodium: Math.round((item.sodiumPer100g || 0) * ratio * 10) / 10,
        potassium: Math.round((item.potassiumPer100g || 0) * ratio * 10) / 10,
        servingAmount: defaultAmount,
        servingUnit: item.servingUnit || 'g',
        servingSizeText: item.servingSizeText,
        imageUrl: item.imageUrl,
        isLocalPreset: true,
        isUserCustom: false,
        barcode: item.barcode,
      };
    });
  },

  onSyncStatusChange(listener: (status: SyncStatus) => void) {
    syncListeners.push(listener);
    listener(currentSyncStatus);
    return () => {
      const index = syncListeners.indexOf(listener);
      if (index > -1) syncListeners.splice(index, 1);
    };
  },

  getCurrentSyncStatus() {
    return currentSyncStatus;
  },

  // Helper for Google Drive
  async saveToCloud(): Promise<boolean> {
    if (!auth.currentUser) {
      notifySyncStatus('offline');
      return false;
    }
    
    // Set pending sync flag immediately so we know there are unsaved local changes
    localStorage.setItem('fitpocket_sync_pending', 'true');
    notifySyncStatus('syncing');

    if (isSavingToDrive) {
      hasPendingDriveSave = true;
      return true;
    }

    isSavingToDrive = true;
    try {
      let finalSuccess = false;
      do {
        hasPendingDriveSave = false;

        // Check for valid token from cache. 
        // CRITICAL: We MUST NOT call loginWithGoogle() automatically here because 
        // background saves (e.g. while typing/editing) are not triggered by direct user clicks.
        const token = await getAccessToken();
        
        if (!token) {
          console.log("No valid Drive token for background sync. Keeping data in local buffer (pending).");
          notifySyncStatus('pending');
          return false;
        }

        const json = this.exportData();
        const success = await DriveStorageService.saveAllData(json);
        if (success) {
          localStorage.removeItem('fitpocket_sync_pending');
          notifySyncStatus('synced');
          finalSuccess = true;
        } else {
          notifySyncStatus('error');
          finalSuccess = false;
        }
      } while (hasPendingDriveSave);

      return finalSuccess;
    } catch (e) {
      console.warn('Failed to save to Drive:', e);
      notifySyncStatus('error');
      return false;
    } finally {
      isSavingToDrive = false;
    }
  },

  async syncFromCloud(): Promise<{ success: boolean; message: string }> {
    if (!auth.currentUser) {
      notifySyncStatus('offline');
      return { success: false, message: '尚未登入 Google 帳號' };
    }

    notifySyncStatus('syncing');
    try {
      const json = await DriveStorageService.loadAllData();
      if (json) {
        // Use merging logic instead of blind import
        const { changed, success } = this.mergeData(json);
        if (success) {
          notifySyncStatus('synced');
          if (changed) {
            return { success: true, message: '成功與 Google Drive 同步並合併資料！' };
          } else {
            return { success: true, message: '雲端資料已是最新，無需更新。' };
          }
        } else {
          notifySyncStatus('error');
          return { success: false, message: '備份檔案格式解析失敗' };
        }
      }
      notifySyncStatus('synced');
      return { success: false, message: '尚未在 Google Drive 找到備份檔 (fitpocket_data.json)' };
    } catch (e: any) {
      console.warn('Drive sync notice:', e);
      notifySyncStatus('error');
      if (e.message === 'AUTH_ERROR') {
        return { success: false, message: '雲端授權已過期，請重新登入 Google 帳號以恢復同步' };
      }
      return { success: false, message: '連線至 Google Drive 失敗，請確認網路或重新連線授權' };
    }
  },

  // Food records
  getAllFoodRecords(): FoodRecord[] {
    return getItem<FoodRecord[]>(STORAGE_KEYS.FOOD_RECORDS, []);
  },
  getRecentFoodHistory(mealType?: MealType, days: number = 7): FoodRecord[] {
    const all = this.getAllFoodRecords();
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    // 1. Filter by 7 days & mealType
    const filtered = all.filter((r) => {
      const isRecent = (r.createdAt || 0) >= cutoff;
      const isMealMatch = mealType ? r.mealType === mealType : true;
      return isRecent && isMealMatch;
    });

    // 2. Group by food identifier (sourceFoodId/barcode/name_brand) & keep MAX(createdAt)
    // Sort ascending first so newer items overwrite older ones in map
    filtered.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

    const map = new Map<string, FoodRecord>();
    for (const record of filtered) {
      let key = '';
      if (record.barcode && record.barcode.trim()) {
        key = `barcode_${record.barcode.trim()}`;
      } else {
        const normName = (record.name || '').trim().toLowerCase();
        const normBrand = (record.brand || '自訂').trim().toLowerCase();
        key = `${normName}_${normBrand}`;
      }
      map.set(key, record);
    }

    // 3. Return array sorted DESC by MAX(createdAt)
    return Array.from(map.values()).sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );
  },
  getFoodRecordsByDate(date: string): FoodRecord[] {
    const all = this.getAllFoodRecords();
    return all.filter((r) => r.date === date);
  },
  saveFoodRecord(record: FoodRecord): FoodRecord {
    const all = this.getAllFoodRecords();
    const index = all.findIndex((r) => r.id === record.id);
    if (index >= 0) {
      all[index] = record;
    } else {
      all.push(record);
    }
    setItem(STORAGE_KEYS.FOOD_RECORDS, all);
    this.saveToCloud();
    return record;
  },
  deleteFoodRecord(id: string): void {
    const all = this.getAllFoodRecords().filter((r) => r.id !== id);
    setItem(STORAGE_KEYS.FOOD_RECORDS, all);
    this.saveToCloud();
  },
  deleteFoodRecordsByMeal(date: string, mealType: string): void {
    const all = this.getAllFoodRecords().filter(
      (r) => !(r.date === date && r.mealType === mealType)
    );
    setItem(STORAGE_KEYS.FOOD_RECORDS, all);
    this.saveToCloud();
  },

  // Custom foods
  getCustomFoods(): CustomFood[] {
    const raw = getItem<any[]>(STORAGE_KEYS.CUSTOM_FOODS, []);
    return raw.map((cf) => {
      const calories = cf.calories !== undefined ? cf.calories : (cf.caloriesPer100g !== undefined ? cf.caloriesPer100g : 0);
      const carbs = cf.carbs !== undefined ? cf.carbs : (cf.carbsPer100g !== undefined ? cf.carbsPer100g : 0);
      const protein = cf.protein !== undefined ? cf.protein : (cf.proteinPer100g !== undefined ? cf.proteinPer100g : 0);
      const fat = cf.fat !== undefined ? cf.fat : (cf.fatPer100g !== undefined ? cf.fatPer100g : 0);
      const sugars = cf.sugars !== undefined ? cf.sugars : (cf.sugarsPer100g !== undefined ? cf.sugarsPer100g : 0);
      const fiber = cf.fiber !== undefined ? cf.fiber : (cf.fiberPer100g !== undefined ? cf.fiberPer100g : 0);
      const sodium = cf.sodium !== undefined ? cf.sodium : (cf.sodiumPer100g !== undefined ? cf.sodiumPer100g : 0);
      const potassium = cf.potassium !== undefined ? cf.potassium : (cf.potassiumPer100g !== undefined ? cf.potassiumPer100g : 0);
      const servingAmount = cf.servingAmount !== undefined ? cf.servingAmount : (cf.defaultServingAmount !== undefined ? cf.defaultServingAmount : 100);

      return {
        ...cf,
        calories,
        carbs,
        protein,
        fat,
        sugars,
        fiber,
        sodium,
        potassium,
        servingAmount,
        // Also keep deprecated keys so that old UI elements still get the values if accessed
        caloriesPer100g: calories,
        carbsPer100g: carbs,
        proteinPer100g: protein,
        fatPer100g: fat,
        sugarsPer100g: sugars,
        fiberPer100g: fiber,
        sodiumPer100g: sodium,
        potassiumPer100g: potassium,
        defaultServingAmount: servingAmount,
      };
    });
  },
  saveCustomFood(food: CustomFood): CustomFood {
    const all = this.getCustomFoods();
    const finalBrand = (food.brand || '').trim() || '自訂';
    const updatedFood = { ...food, brand: finalBrand, updatedAt: Date.now() };
    const index = all.findIndex((f) => f.id === food.id || (f.name.trim() === food.name.trim() && (f.brand || '').trim() === finalBrand));
    if (index >= 0) {
      all[index] = updatedFood;
    } else {
      all.unshift(updatedFood);
    }
    setItem(STORAGE_KEYS.CUSTOM_FOODS, all);
    this.saveToCloud();
    return updatedFood;
  },
  deleteCustomFood(id: string): void {
    const all = this.getCustomFoods().filter((f) => f.id !== id);
    setItem(STORAGE_KEYS.CUSTOM_FOODS, all);
    this.saveToCloud();
  },

  // Search local and custom foods
  searchFoods(query: string = ''): FoodSearchResult[] {
    const trimmed = query.trim().toLowerCase();
    const presets = this.getPresetFoods();
    const custom = this.getCustomFoods().map((cf: any) => {
      const calories = cf.calories !== undefined ? cf.calories : (cf.caloriesPer100g !== undefined ? cf.caloriesPer100g : 0);
      const carbs = cf.carbs !== undefined ? cf.carbs : (cf.carbsPer100g !== undefined ? cf.carbsPer100g : 0);
      const protein = cf.protein !== undefined ? cf.protein : (cf.proteinPer100g !== undefined ? cf.proteinPer100g : 0);
      const fat = cf.fat !== undefined ? cf.fat : (cf.fatPer100g !== undefined ? cf.fatPer100g : 0);
      const sugars = cf.sugars !== undefined ? cf.sugars : (cf.sugarsPer100g !== undefined ? cf.sugarsPer100g : 0);
      const fiber = cf.fiber !== undefined ? cf.fiber : (cf.fiberPer100g !== undefined ? cf.fiberPer100g : 0);
      const sodium = cf.sodium !== undefined ? cf.sodium : (cf.sodiumPer100g !== undefined ? cf.sodiumPer100g : 0);
      const potassium = cf.potassium !== undefined ? cf.potassium : (cf.potassiumPer100g !== undefined ? cf.potassiumPer100g : 0);
      const servingAmount = cf.servingAmount !== undefined ? cf.servingAmount : (cf.defaultServingAmount !== undefined ? cf.defaultServingAmount : 100);

      return {
        id: `custom_${cf.id}`,
        name: cf.name,
        brand: cf.brand || '自訂',
        calories,
        carbs,
        sugars,
        fiber,
        protein,
        fat,
        sodium,
        potassium,
        servingAmount,
        servingUnit: cf.servingUnit || 'g',
        imageUrl: cf.imageUrl,
        isLocalPreset: false,
        isUserCustom: true,
        barcode: cf.barcode,
      };
    });

    const all = [...custom, ...presets];
    if (!trimmed) return all;

    return all.filter((item) => {
      const matchName = item.name.toLowerCase().includes(trimmed);
      const matchBrand = item.brand.toLowerCase().includes(trimmed);
      const matchBarcode = item.barcode && item.barcode.includes(trimmed);
      return matchName || matchBrand || matchBarcode;
    });
  },

  // Water records
  getAllWaterRecords(): WaterRecord[] {
    return getItem<WaterRecord[]>(STORAGE_KEYS.WATER_RECORDS, []);
  },
  getWaterRecordsByDate(date: string): WaterRecord[] {
    return this.getAllWaterRecords().filter((r) => r.date === date);
  },
  saveWaterRecord(record: WaterRecord): WaterRecord {
    const all = this.getAllWaterRecords();
    all.push(record);
    setItem(STORAGE_KEYS.WATER_RECORDS, all);
    this.saveToCloud();
    return record;
  },
  deleteWaterRecord(id: string): void {
    const all = this.getAllWaterRecords().filter((r) => r.id !== id);
    setItem(STORAGE_KEYS.WATER_RECORDS, all);
    this.saveToCloud();
  },
  getWaterGoal(): number {
    return getItem<number>(STORAGE_KEYS.WATER_GOAL, 2500);
  },
  setWaterGoal(goalMl: number): void {
    setItem(STORAGE_KEYS.WATER_GOAL, goalMl);
    this.saveToCloud();
  },
  getWaterPresets(): number[] {
    const defaults = [100, 250, 350, 500, 750, 1000];
    const saved = getItem<number[]>(STORAGE_KEYS.WATER_PRESETS, defaults);
    if (Array.isArray(saved) && saved.length === 6) {
      return saved;
    }
    return defaults;
  },
  setWaterPresets(presets: number[]): void {
    setItem(STORAGE_KEYS.WATER_PRESETS, presets);
    this.saveToCloud();
  },

  // Weight records
  getAllWeightRecords(): WeightRecord[] {
    return getItem<WeightRecord[]>(STORAGE_KEYS.WEIGHT_RECORDS, [
      {
        id: 'seed_weight_1',
        date: getTodayString(),
        morningWeightKg: 72.5,
        morningTime: '08:00',
        eveningWeightKg: 73.2,
        eveningTime: '21:30',
        createdAt: Date.now(),
      },
    ]);
  },
  getWeightRecordByDate(date: string): WeightRecord | undefined {
    return this.getAllWeightRecords().find((r) => r.date === date);
  },
  saveWeightRecord(record: WeightRecord): WeightRecord {
    const all = this.getAllWeightRecords();
    const updatedRecord = { ...record, createdAt: Date.now() };
    const index = all.findIndex((r) => r.date === record.date);
    if (index >= 0) {
      all[index] = updatedRecord;
    } else {
      all.push(updatedRecord);
    }
    setItem(STORAGE_KEYS.WEIGHT_RECORDS, all);
    this.saveToCloud();
    return updatedRecord;
  },
  deleteWeightRecord(id: string): void {
    const all = this.getAllWeightRecords().filter((r) => r.id !== id);
    setItem(STORAGE_KEYS.WEIGHT_RECORDS, all);
    this.saveToCloud();
  },

  // Workouts
  getAllWorkoutRecords(): WorkoutRecord[] {
    return getItem<WorkoutRecord[]>(STORAGE_KEYS.WORKOUT_RECORDS, []);
  },
  getWorkoutsByDate(date: string): WorkoutRecord[] {
    return this.getAllWorkoutRecords().filter((w) => w.date === date);
  },
  saveWorkoutRecord(record: WorkoutRecord): WorkoutRecord {
    const all = this.getAllWorkoutRecords();
    const updatedRecord = { ...record, updatedAt: Date.now() };
    const index = all.findIndex((w) => w.id === record.id);
    if (index >= 0) {
      all[index] = updatedRecord;
    } else {
      all.push(updatedRecord);
    }
    setItem(STORAGE_KEYS.WORKOUT_RECORDS, all);
    this.saveToCloud();
    return updatedRecord;
  },
  deleteWorkoutRecord(id: string): void {
    const all = this.getAllWorkoutRecords().filter((w) => w.id !== id);
    setItem(STORAGE_KEYS.WORKOUT_RECORDS, all);
    this.saveToCloud();
  },

  // Carb cycle presets
  getPresets(): Record<CarbCycleType, NutritionGoalPreset> {
    return getItem<Record<CarbCycleType, NutritionGoalPreset>>(
      STORAGE_KEYS.CARB_PRESETS,
      DEFAULT_PRESETS
    );
  },
  savePresets(presets: Record<CarbCycleType, NutritionGoalPreset>): void {
    setItem(STORAGE_KEYS.CARB_PRESETS, presets);
    this.saveToCloud();
  },
  
  // Timer presets
  getTimerPresets(): number[] {
    return getItem<number[]>(STORAGE_KEYS.WORKOUT_PRESETS, [30, 60, 90, 120]);
  },
  saveTimerPresets(presets: number[]): void {
    setItem(STORAGE_KEYS.WORKOUT_PRESETS, presets);
    this.saveToCloud();
  },
  getActiveCarbCycle(): CarbCycleType {
    return getItem<CarbCycleType>(STORAGE_KEYS.ACTIVE_CARB_CYCLE, 'MEDIUM');
  },
  setActiveCarbCycle(type: CarbCycleType): void {
    setItem(STORAGE_KEYS.ACTIVE_CARB_CYCLE, type);
    this.saveToCloud();
  },

  // Daily Configs (Date-specific settings)
  getDailyConfigs(): DailyConfig[] {
    return getItem<DailyConfig[]>(STORAGE_KEYS.DAILY_CONFIGS, []);
  },
  getDailyConfig(date: string): DailyConfig | null {
    const all = this.getDailyConfigs();
    return all.find(c => c.date === date) || null;
  },
  saveDailyConfig(config: DailyConfig): void {
    const all = this.getDailyConfigs();
    const index = all.findIndex(c => c.date === config.date);
    const updated = { ...config, updatedAt: Date.now() };
    if (index >= 0) {
      all[index] = updated;
    } else {
      all.push(updated);
    }
    setItem(STORAGE_KEYS.DAILY_CONFIGS, all);
    this.saveToCloud();
  },

  // Meals
  getActiveMeals(date?: string): MealConfig[] {
    let baseMeals: MealConfig[] = [];
    if (date) {
      const daily = this.getDailyConfig(date);
      if (daily && daily.activeMeals && daily.activeMeals.length > 0) {
        baseMeals = daily.activeMeals;
      } else {
        baseMeals = getItem<MealConfig[]>(STORAGE_KEYS.ACTIVE_MEALS, DEFAULT_MEALS);
      }
    } else {
      baseMeals = getItem<MealConfig[]>(STORAGE_KEYS.ACTIVE_MEALS, DEFAULT_MEALS);
    }

    if (date) {
      // Safeguard: Always ensure any mealType that has food records on this date is included
      const records = this.getFoodRecordsByDate(date);
      const activeTypes = new Set(baseMeals.map(m => m.mealType));
      const missingMeals: MealConfig[] = [];

      for (const r of records) {
        if (!activeTypes.has(r.mealType)) {
          activeTypes.add(r.mealType);
          const defaultInfo = DEFAULT_MEALS.find(m => m.mealType === r.mealType);
          missingMeals.push({
            mealType: r.mealType,
            customName: defaultInfo?.customName || (r.mealType === 'SNACK' ? '點心' : '餐次'),
            isCustom: !defaultInfo,
          });
        }
      }

      if (missingMeals.length > 0) {
        return [...baseMeals, ...missingMeals];
      }
    }

    return baseMeals;
  },

  saveActiveMeals(meals: MealConfig[], date?: string): void {
    if (date) {
      const existing = this.getDailyConfig(date) || {
        date,
        carbCycle: this.getActiveCarbCycle(),
        updatedAt: Date.now(),
      };
      this.saveDailyConfig({
        ...existing,
        activeMeals: meals,
        updatedAt: Date.now(),
      });
    }
    // Also update global default active meals template
    setItem(STORAGE_KEYS.ACTIVE_MEALS, meals);
    this.saveToCloud();
  },

  // Exercises & Muscle Groups
  getExercises(): { name: string; bodyPart: string }[] {
    return getItem<{ name: string; bodyPart: string }[]>(
      STORAGE_KEYS.EXERCISES,
      DEFAULT_EXERCISES
    );
  },
  saveExercises(exercises: { name: string; bodyPart: string }[]): void {
    setItem(STORAGE_KEYS.EXERCISES, exercises);
    this.saveToCloud();
  },
  getMuscleGroups(): string[] {
    return getItem<string[]>(STORAGE_KEYS.MUSCLE_GROUPS, DEFAULT_MUSCLE_GROUPS);
  },
  saveMuscleGroups(groups: string[]): void {
    setItem(STORAGE_KEYS.MUSCLE_GROUPS, groups);
    this.saveToCloud();
  },
  getCustomBodyParts(): string[] {
    return getItem<string[]>(STORAGE_KEYS.CUSTOM_BODY_PARTS, []);
  },
  addCustomBodyPart(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    const current = this.getCustomBodyParts();
    if (!current.includes(trimmed)) {
      const updated = [trimmed, ...current];
      setItem(STORAGE_KEYS.CUSTOM_BODY_PARTS, updated);
      this.saveToCloud();
    }
  },
  deleteCustomBodyPart(name: string): void {
    const current = this.getCustomBodyParts();
    const updated = current.filter((n) => n !== name);
    setItem(STORAGE_KEYS.CUSTOM_BODY_PARTS, updated);
    this.saveToCloud();
  },

  // User profile
  getUserProfile(): UserProfile {
    return getItem<UserProfile>(STORAGE_KEYS.USER_PROFILE, DEFAULT_USER_PROFILE);
  },
  saveUserProfile(profile: UserProfile): void {
    const updatedProfile = { ...profile, updatedAt: Date.now() };
    setItem(STORAGE_KEYS.USER_PROFILE, updatedProfile);
    this.saveToCloud();
  },

  // Custom Gemini Key
  getGeminiApiKey(): string {
    const raw = getItem<string>(STORAGE_KEYS.GEMINI_KEY, '');
    return decryptApiKey(raw);
  },
  saveGeminiApiKey(key: string): void {
    const encrypted = encryptApiKey(key);
    setItem(STORAGE_KEYS.GEMINI_KEY, encrypted);
    this.saveToCloud();
  },

  // Gemini Model Selection
  getSelectedAiModel(): string {
    return getItem<string>(STORAGE_KEYS.GEMINI_MODEL, 'gemini-3.8-flash');
  },
  saveSelectedAiModel(model: string): void {
    setItem(STORAGE_KEYS.GEMINI_MODEL, model);
    this.saveToCloud();
  },

  // Export / Backup all data
  exportData(): string {
    const rawKey = getItem<string>(STORAGE_KEYS.GEMINI_KEY, '');
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      foodRecords: this.getAllFoodRecords(),
      customFoods: this.getCustomFoods(),
      waterRecords: this.getAllWaterRecords(),
      waterGoal: this.getWaterGoal(),
      weightRecords: this.getAllWeightRecords(),
      workoutRecords: this.getAllWorkoutRecords(),
      presets: this.getPresets(),
      activeCarbCycle: this.getActiveCarbCycle(),
      activeMeals: this.getActiveMeals(),
      userProfile: this.getUserProfile(),
      exercises: this.getExercises(),
      muscleGroups: this.getMuscleGroups(),
      workoutPresets: this.getTimerPresets(),
      waterPresets: this.getWaterPresets(),
      customBodyParts: this.getCustomBodyParts(),
      geminiApiKey: rawKey, // already encrypted in storage
      geminiModel: this.getSelectedAiModel(),
      dailyConfigs: this.getDailyConfigs(),
    };
    return JSON.stringify(data, null, 2);
  },

  // Import data
  importData(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.foodRecords) setItem(STORAGE_KEYS.FOOD_RECORDS, data.foodRecords);
      if (data.customFoods) setItem(STORAGE_KEYS.CUSTOM_FOODS, data.customFoods);
      if (data.waterRecords) setItem(STORAGE_KEYS.WATER_RECORDS, data.waterRecords);
      if (data.waterGoal) setItem(STORAGE_KEYS.WATER_GOAL, data.waterGoal);
      if (data.weightRecords) setItem(STORAGE_KEYS.WEIGHT_RECORDS, data.weightRecords);
      if (data.workoutRecords) setItem(STORAGE_KEYS.WORKOUT_RECORDS, data.workoutRecords);
      if (data.presets) setItem(STORAGE_KEYS.CARB_PRESETS, data.presets);
      if (data.activeCarbCycle) setItem(STORAGE_KEYS.ACTIVE_CARB_CYCLE, data.activeCarbCycle);
      if (data.activeMeals) setItem(STORAGE_KEYS.ACTIVE_MEALS, data.activeMeals);
      if (data.userProfile) setItem(STORAGE_KEYS.USER_PROFILE, data.userProfile);
      if (data.exercises) setItem(STORAGE_KEYS.EXERCISES, data.exercises);
      if (data.muscleGroups) setItem(STORAGE_KEYS.MUSCLE_GROUPS, data.muscleGroups);
      if (data.workoutPresets) setItem(STORAGE_KEYS.WORKOUT_PRESETS, data.workoutPresets);
      if (data.waterPresets) setItem(STORAGE_KEYS.WATER_PRESETS, data.waterPresets);
      if (data.customBodyParts) setItem(STORAGE_KEYS.CUSTOM_BODY_PARTS, data.customBodyParts);
      if (data.geminiApiKey) setItem(STORAGE_KEYS.GEMINI_KEY, data.geminiApiKey);
      if (data.geminiModel) setItem(STORAGE_KEYS.GEMINI_MODEL, data.geminiModel);
      if (data.dailyConfigs) setItem(STORAGE_KEYS.DAILY_CONFIGS, data.dailyConfigs);
      
      // After manual import, immediately upload to cloud to make this the "latest" version
      this.saveToCloud();
      return true;
    } catch (e) {
      console.error('Failed to parse import data:', e);
      return false;
    }
  },

  // Intelligent Merging logic
  mergeData(jsonString: string): { changed: boolean; success: boolean } {
    try {
      const incoming = JSON.parse(jsonString);
      let localChanged = false;

      // 1. Food Records (Merge by id, newer createdAt wins)
      const localFood = this.getAllFoodRecords();
      const incomingFood = incoming.foodRecords || [];
      const mergedFood = this.mergeCollections(localFood, incomingFood, 'id', 'createdAt');
      if (JSON.stringify(mergedFood) !== JSON.stringify(localFood)) {
        setItem(STORAGE_KEYS.FOOD_RECORDS, mergedFood);
        localChanged = true;
      }

      // 2. Custom Foods (Merge by id, newer updatedAt wins)
      const localCustom = this.getCustomFoods();
      const incomingCustom = incoming.customFoods || [];
      const mergedCustom = this.mergeCollections(localCustom, incomingCustom, 'id', 'updatedAt');
      if (JSON.stringify(mergedCustom) !== JSON.stringify(localCustom)) {
        setItem(STORAGE_KEYS.CUSTOM_FOODS, mergedCustom);
        localChanged = true;
      }

      // 3. Water Records (Merge by id, newer timestamp wins)
      const localWater = this.getAllWaterRecords();
      const incomingWater = incoming.waterRecords || [];
      const mergedWater = this.mergeCollections(localWater, incomingWater, 'id', 'timestamp');
      if (JSON.stringify(mergedWater) !== JSON.stringify(localWater)) {
        setItem(STORAGE_KEYS.WATER_RECORDS, mergedWater);
        localChanged = true;
      }

      // 4. Weight Records (Merge by date, newer createdAt wins)
      const localWeight = this.getAllWeightRecords();
      const incomingWeight = incoming.weightRecords || [];
      const mergedWeight = this.mergeCollections(localWeight, incomingWeight, 'date', 'createdAt');
      if (JSON.stringify(mergedWeight) !== JSON.stringify(localWeight)) {
        setItem(STORAGE_KEYS.WEIGHT_RECORDS, mergedWeight);
        localChanged = true;
      }

      // 5. Workout Records (Merge by id, newer updatedAt wins)
      const localWorkout = this.getAllWorkoutRecords();
      const incomingWorkout = incoming.workoutRecords || [];
      const mergedWorkout = this.mergeCollections(localWorkout, incomingWorkout, 'id', 'updatedAt');
      if (JSON.stringify(mergedWorkout) !== JSON.stringify(localWorkout)) {
        setItem(STORAGE_KEYS.WORKOUT_RECORDS, mergedWorkout);
        localChanged = true;
      }

      // 5b. Daily Configs (Merge by date, newer updatedAt wins)
      const localDaily = this.getDailyConfigs();
      const incomingDaily = incoming.dailyConfigs || [];
      const mergedDaily = this.mergeCollections(localDaily, incomingDaily, 'date', 'updatedAt');
      if (JSON.stringify(mergedDaily) !== JSON.stringify(localDaily)) {
        setItem(STORAGE_KEYS.DAILY_CONFIGS, mergedDaily);
        localChanged = true;
      }

      // 6. Profile & Settings (Keep newer version)
      const localProfile = this.getUserProfile();
      const incomingProfile = incoming.userProfile;
      if (incomingProfile) {
        const localTime = localProfile.updatedAt || 0;
        const incomingTime = incomingProfile.updatedAt || 0;
        if (incomingTime > localTime) {
          setItem(STORAGE_KEYS.USER_PROFILE, incomingProfile);
          localChanged = true;
        }
      }

      if (incoming.waterGoal) {
        setItem(STORAGE_KEYS.WATER_GOAL, incoming.waterGoal);
        localChanged = true;
      }
      if (incoming.presets) {
        setItem(STORAGE_KEYS.CARB_PRESETS, incoming.presets);
        localChanged = true;
      }
      if (incoming.activeMeals) {
        setItem(STORAGE_KEYS.ACTIVE_MEALS, incoming.activeMeals);
        localChanged = true;
      }
      if (incoming.workoutPresets) {
        setItem(STORAGE_KEYS.WORKOUT_PRESETS, incoming.workoutPresets);
        localChanged = true;
      }
      if (incoming.waterPresets) {
        setItem(STORAGE_KEYS.WATER_PRESETS, incoming.waterPresets);
        localChanged = true;
      }
      if (incoming.exercises) {
        setItem(STORAGE_KEYS.EXERCISES, incoming.exercises);
        localChanged = true;
      }
      if (incoming.muscleGroups) {
        setItem(STORAGE_KEYS.MUSCLE_GROUPS, incoming.muscleGroups);
        localChanged = true;
      }
      if (incoming.customBodyParts) {
        setItem(STORAGE_KEYS.CUSTOM_BODY_PARTS, incoming.customBodyParts);
        localChanged = true;
      }
      if (incoming.geminiModel) {
        setItem(STORAGE_KEYS.GEMINI_MODEL, incoming.geminiModel);
        localChanged = true;
      }

      // If we integrated changes, upload the new merged state back to cloud
      if (localChanged) {
        this.saveToCloud();
      }

      return { changed: localChanged, success: true };
    } catch (e) {
      console.error('Failed to merge data:', e);
      return { changed: false, success: false };
    }
  },

  mergeCollections<T extends any>(local: T[], incoming: T[], key: string, timeKey: string): T[] {
    const map = new Map<string, T>();
    local.forEach(item => {
      const itemAny = item as any;
      map.set(itemAny[key], item);
    });
    
    incoming.forEach(item => {
      const itemAny = item as any;
      const existing = map.get(itemAny[key]);
      if (!existing) {
        map.set(itemAny[key], item);
      } else {
        const existingAny = existing as any;
        const localTime = existingAny[timeKey] || 0;
        const incomingTime = itemAny[timeKey] || 0;
        if (incomingTime > localTime) {
          map.set(itemAny[key], item);
        }
      }
    });

    return Array.from(map.values());
  },
};
