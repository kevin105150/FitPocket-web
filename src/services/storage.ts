import { getTodayString } from '../utils/dateUtils';
import {
  CarbCycleType,
  CustomFood,
  FoodRecord,
  FoodSearchResult,
  MealConfig,
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
import { auth } from '../lib/firebase';
import { DriveStorageService } from './driveStorage';
import { encryptApiKey, decryptApiKey } from '../utils/encryption';

const STORAGE_KEYS = {
  FOOD_RECORDS: 'fitpocket_food_records',
  CUSTOM_FOODS: 'fitpocket_custom_foods',
  WATER_RECORDS: 'fitpocket_water_records',
  WATER_GOAL: 'fitpocket_water_goal',
  WEIGHT_RECORDS: 'fitpocket_weight_records',
  WORKOUT_RECORDS: 'fitpocket_workout_records',
  CARB_PRESETS: 'fitpocket_carb_presets',
  ACTIVE_MEALS: 'fitpocket_active_meals',
  ACTIVE_CARB_CYCLE: 'fitpocket_active_carb_cycle',
  USER_PROFILE: 'fitpocket_user_profile',
  EXERCISES: 'fitpocket_exercises',
  MUSCLE_GROUPS: 'fitpocket_muscle_groups',
  GEMINI_KEY: 'fitpocket_gemini_key',
  GEMINI_MODEL: 'fitpocket_gemini_model',
  WORKOUT_PRESETS: 'fitpocket_workout_presets',
};

// Safe storage access
function getItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : defaultValue;
  } catch (e) {
    console.warn(`Failed reading key ${key} from storage:`, e);
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn(`Failed saving key ${key} to storage:`, e);
  }
}

export const StorageService = {
  // Preset foods
  getPresetFoods(): FoodSearchResult[] {
    return (presetFoodsData as any[]).map((item) => {
      const defaultAmount = item.defaultServingAmount || 100;
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

  // Helper for Google Drive
  async saveToCloud(): Promise<boolean> {
    if (!auth.currentUser) return false;
    try {
      const json = this.exportData();
      return await DriveStorageService.saveAllData(json);
    } catch (e) {
      console.warn('Failed to save to Drive:', e);
      return false;
    }
  },

  async syncFromCloud(): Promise<{ success: boolean; message: string }> {
    if (!auth.currentUser) {
      return { success: false, message: '尚未登入 Google 帳號' };
    }
    try {
      const json = await DriveStorageService.loadAllData();
      if (json) {
        const ok = this.importData(json);
        return ok
          ? { success: true, message: '成功從 Google Drive 同步資料！' }
          : { success: false, message: '備份檔案格式解析失敗' };
      }
      return { success: false, message: '尚未在 Google Drive 找到備份檔 (fitpocket_data.json)' };
    } catch (e: any) {
      console.warn('Drive sync notice:', e);
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
    const updatedFood = { ...food, updatedAt: Date.now() };
    const index = all.findIndex((f) => f.id === food.id);
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
        brand: cf.brand || '我的常用自訂',
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
    const index = all.findIndex((w) => w.id === record.id);
    if (index >= 0) {
      all[index] = record;
    } else {
      all.push(record);
    }
    setItem(STORAGE_KEYS.WORKOUT_RECORDS, all);
    this.saveToCloud();
    return record;
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
  },

  // Meals
  getActiveMeals(): MealConfig[] {
    return getItem<MealConfig[]>(STORAGE_KEYS.ACTIVE_MEALS, DEFAULT_MEALS);
  },
  saveActiveMeals(meals: MealConfig[]): void {
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
  },
  getMuscleGroups(): string[] {
    return getItem<string[]>(STORAGE_KEYS.MUSCLE_GROUPS, DEFAULT_MUSCLE_GROUPS);
  },
  saveMuscleGroups(groups: string[]): void {
    setItem(STORAGE_KEYS.MUSCLE_GROUPS, groups);
  },

  // User profile
  getUserProfile(): UserProfile {
    return getItem<UserProfile>(STORAGE_KEYS.USER_PROFILE, DEFAULT_USER_PROFILE);
  },
  saveUserProfile(profile: UserProfile): void {
    setItem(STORAGE_KEYS.USER_PROFILE, profile);
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
      geminiApiKey: rawKey, // already encrypted in storage
      geminiModel: this.getSelectedAiModel(),
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
      if (data.geminiApiKey) setItem(STORAGE_KEYS.GEMINI_KEY, data.geminiApiKey);
      if (data.geminiModel) setItem(STORAGE_KEYS.GEMINI_MODEL, data.geminiModel);
      return true;
    } catch (e) {
      console.error('Failed to parse import data:', e);
      return false;
    }
  },
};
