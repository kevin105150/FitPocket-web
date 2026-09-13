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
    return presetFoodsData as FoodSearchResult[];
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
    return record;
  },
  deleteFoodRecord(id: string): void {
    const all = this.getAllFoodRecords().filter((r) => r.id !== id);
    setItem(STORAGE_KEYS.FOOD_RECORDS, all);
  },
  deleteFoodRecordsByMeal(date: string, mealType: string): void {
    const all = this.getAllFoodRecords().filter(
      (r) => !(r.date === date && r.mealType === mealType)
    );
    setItem(STORAGE_KEYS.FOOD_RECORDS, all);
  },

  // Custom foods
  getCustomFoods(): CustomFood[] {
    return getItem<CustomFood[]>(STORAGE_KEYS.CUSTOM_FOODS, []);
  },
  saveCustomFood(food: CustomFood): CustomFood {
    const all = this.getCustomFoods();
    const index = all.findIndex((f) => f.id === food.id);
    if (index >= 0) {
      all[index] = { ...food, updatedAt: Date.now() };
    } else {
      all.unshift({ ...food, updatedAt: Date.now() });
    }
    setItem(STORAGE_KEYS.CUSTOM_FOODS, all);
    return food;
  },
  deleteCustomFood(id: string): void {
    const all = this.getCustomFoods().filter((f) => f.id !== id);
    setItem(STORAGE_KEYS.CUSTOM_FOODS, all);
  },

  // Search local and custom foods
  searchFoods(query: string = ''): FoodSearchResult[] {
    const trimmed = query.trim().toLowerCase();
    const presets = this.getPresetFoods();
    const custom = this.getCustomFoods().map((cf) => ({
      id: `custom_${cf.id}`,
      name: cf.name,
      brand: cf.brand || '我的常用自訂',
      caloriesPer100g: cf.caloriesPer100g,
      carbsPer100g: cf.carbsPer100g,
      sugarsPer100g: cf.sugarsPer100g,
      fiberPer100g: cf.fiberPer100g,
      proteinPer100g: cf.proteinPer100g,
      fatPer100g: cf.fatPer100g,
      sodiumPer100g: cf.sodiumPer100g,
      potassiumPer100g: cf.potassiumPer100g,
      defaultServingAmount: cf.defaultServingAmount,
      servingUnit: cf.servingUnit,
      servingSizeText: cf.servingSizeText,
      imageUrl: cf.imageUrl,
      isLocalPreset: false,
      isUserCustom: true,
      barcode: cf.barcode,
    }));

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
    return record;
  },
  deleteWaterRecord(id: string): void {
    const all = this.getAllWaterRecords().filter((r) => r.id !== id);
    setItem(STORAGE_KEYS.WATER_RECORDS, all);
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
    const index = all.findIndex((r) => r.date === record.date);
    if (index >= 0) {
      all[index] = { ...record, createdAt: Date.now() };
    } else {
      all.push({ ...record, createdAt: Date.now() });
    }
    setItem(STORAGE_KEYS.WEIGHT_RECORDS, all);
    return record;
  },
  deleteWeightRecord(id: string): void {
    const all = this.getAllWeightRecords().filter((r) => r.id !== id);
    setItem(STORAGE_KEYS.WEIGHT_RECORDS, all);
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
    return record;
  },
  deleteWorkoutRecord(id: string): void {
    const all = this.getAllWorkoutRecords().filter((w) => w.id !== id);
    setItem(STORAGE_KEYS.WORKOUT_RECORDS, all);
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
  },

  // Custom Gemini Key
  getGeminiApiKey(): string {
    return getItem<string>(STORAGE_KEYS.GEMINI_KEY, '');
  },
  saveGeminiApiKey(key: string): void {
    setItem(STORAGE_KEYS.GEMINI_KEY, key);
  },

  // Export / Backup all data
  exportData(): string {
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
      return true;
    } catch (e) {
      console.error('Failed to parse import data:', e);
      return false;
    }
  },
};
