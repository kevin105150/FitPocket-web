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
  name: string;
  mealType: MealType;
  date: string; // YYYY-MM-DD
  calories: number;
  carbs: number;
  sugars: number;
  fiber: number;
  protein: number;
  fat: number;
  sodium: number;
  potassium: number;
  amount: number;
  unit: string;
  barcode?: string;
  imageUrl?: string;
  note?: string;
  createdAt: number;
}

export interface CustomFood {
  id: string;
  name: string;
  brand: string;
  caloriesPer100g: number;
  carbsPer100g: number;
  sugarsPer100g: number;
  fiberPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  sodiumPer100g: number;
  potassiumPer100g: number;
  defaultServingAmount: number;
  servingUnit: string;
  servingSizeText?: string;
  imageUrl?: string;
  barcode?: string;
  updatedAt: number;
}

export interface FoodSearchResult {
  id: string;
  name: string;
  brand: string;
  caloriesPer100g: number;
  carbsPer100g: number;
  sugarsPer100g: number;
  fiberPer100g: number;
  proteinPer100g: number;
  fatPer100g: number;
  sodiumPer100g: number;
  potassiumPer100g: number;
  defaultServingAmount: number;
  servingUnit: string;
  servingSizeText?: string;
  imageUrl?: string;
  isLocalPreset?: boolean;
  isUserCustom?: boolean;
  barcode?: string;
}

export type CarbCycleType = 'HIGH' | 'MEDIUM' | 'LOW' | 'CUSTOM';

export interface CarbCycleInfo {
  type: CarbCycleType;
  displayName: string;
  shortName: string;
  emoji: string;
  description: string;
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
}

export interface WorkoutRecord {
  id: string;
  date: string; // YYYY-MM-DD
  bodyPart: string;
  note?: string;
  exercises: WorkoutExercise[];
}

export interface UserProfile {
  gender: 'male' | 'female';
  age: number;
  heightCm: number;
  currentWeightKg: number;
  targetWeightKg: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'heavy' | 'athlete';
  fitnessGoal: 'fat_loss' | 'maintain' | 'muscle_gain';
}
