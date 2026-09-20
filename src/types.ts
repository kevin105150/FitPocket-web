export type MealType =
  | 'BREAKFAST'
  | 'LUNCH'
  | 'DINNER'
  | 'SNACK'
  | 'MEAL_5'
  | 'MEAL_6'
  | 'MEAL_7'
  | 'MEAL_8'
  | 'MEAL_9'
  | 'MEAL_10';

export interface MealConfig {
  mealType: MealType;
  customName: string;
  isCustom: boolean;
}

export interface FoodRecord {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  sourceFoodId?: string;
  barcode?: string;
  brand?: string;
  loggedAmount: number; // actual amount consumed (e.g. 1.5 or 200)
  loggedUnit: string;   // actual unit used (e.g. "份", "g", "ml")
  baseServingAmount?: number; // original base single serving size e.g. 100
  baseServingUnit?: string;   // original base single serving unit e.g. "g"
  baseCalories?: number;      // original base calories for base serving size
  baseCarbs?: number;
  baseSugars?: number;
  baseFiber?: number;
  baseProtein?: number;
  baseFat?: number;
  baseSodium?: number;
  basePotassium?: number;
  name: string;
  calories: number;
  carbs: number;
  sugars: number;
  fiber: number;
  protein: number;
  fat: number;
  sodium: number;
  potassium: number;
  note?: string;
  createdAt: number;
  aiSource?: 'vision' | 'estimation';
  isOpenFood?: boolean;
}

export interface CustomFood {
  id: string;
  name: string;
  brand: string;
  servingAmount: number;
  servingUnit: string;
  calories: number;
  carbs: number;
  sugars: number;
  fiber: number;
  protein: number;
  fat: number;
  sodium: number;
  potassium: number;
  imageUrl?: string;
  barcode?: string;
  updatedAt?: number;
  aiSource?: 'vision' | 'estimation';
  isSharedToCloud?: boolean;
}

export interface CloudFood {
  id: string;
  name: string;
  brand: string;
  servingAmount: number;
  servingUnit: string;
  calories: number;
  carbs: number;
  sugars: number;
  fiber: number;
  protein: number;
  fat: number;
  sodium: number;
  potassium: number;
  imageUrl?: string;
  barcode?: string;
  createdAt: number;
  updatedAt: number;
}

export interface FoodSearchResult {
  id: string;
  name: string;
  brand: string;
  calories: number;
  carbs: number;
  sugars: number;
  fiber: number;
  protein: number;
  fat: number;
  sodium: number;
  potassium: number;
  servingAmount: number;
  servingUnit: string;
  servingSizeText?: string;
  imageUrl?: string;
  isLocalPreset?: boolean;
  isUserCustom?: boolean;
  isCloudPreset?: boolean;
  barcode?: string;
  aiSource?: 'vision' | 'estimation';
  lastLoggedAmount?: number;
  isOpenFood?: boolean;
}

export type CarbCycleType = 'HIGH' | 'MEDIUM' | 'LOW' | 'CUSTOM';

export interface CarbCycleInfo {
  type: CarbCycleType;
  displayName: string;
  shortName: string;
  emoji: string;
  description: string;
}

export interface DailyConfig {
  date: string; // YYYY-MM-DD
  carbCycle: CarbCycleType;
  customGoals?: Partial<NutritionGoalPreset>;
  activeMeals?: MealConfig[];
  updatedAt: number;
}

export interface NutritionGoalPreset {
  type: CarbCycleType;
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
  sodium: number;
  potassium: number;
}

export interface WaterRecord {
  id: string;
  date: string; // YYYY-MM-DD
  amountMl: number;
  timestamp: number;
}

export interface WeightRecord {
  id: string;
  date: string; // YYYY-MM-DD
  morningWeightKg?: number | null;
  morningTime?: string | null;
  eveningWeightKg?: number | null;
  eveningTime?: string | null;
  createdAt: number;
}

export interface ExerciseSet {
  id: string;
  exerciseId: string;
  setIndex: number;
  reps: number;
  weight: number;
  durationMinutes?: number;
  isCompleted: boolean;
}

export interface WorkoutExercise {
  id: string;
  workoutId: string;
  name: string;
  bodyPart?: string;
  sets: number;
  reps: number;
  weight: number;
  supersetGroupId?: number | null;
  isCardio?: boolean;
  exerciseSets: ExerciseSet[];
  updatedAt?: number;
}

export interface WorkoutRecord {
  id: string;
  date: string; // YYYY-MM-DD
  bodyPart: string;
  note?: string;
  exercises: WorkoutExercise[];
  updatedAt: number;
}

export interface UserProfile {
  gender: 'male' | 'female';
  age: number;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'heavy' | 'athlete';
  fitnessGoal: 'fat_loss' | 'maintain' | 'muscle_gain';
  updatedAt?: number;
}
