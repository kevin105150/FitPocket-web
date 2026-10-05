import { MealConfig, MealType } from '../types';
import { StorageService } from '../services/storage';

export interface AvailableMealLike {
  type?: MealType;
  mealType?: MealType;
  name?: string;
  customName?: string;
}

/**
 * 依目前時段智慧判定預設餐別
 * 時段劃分：
 * - 04:00 ~ 10:59: 早餐 (BREAKFAST)
 * - 11:00 ~ 15:59: 午餐 (LUNCH)
 * - 16:00 ~ 20:59: 晚餐 (DINNER)
 * - 21:00 ~ 03:59: 點心 / 宵夜 (SNACK)
 *
 * 智慧容錯與優先權：
 * 1. 同時比對 mealType 與 customName (支援自訂名稱如「早午餐」、「午餐」、「晚餐」、「宵夜」等)。
 * 2. 若時段為 21:00 後 (消夜/點心時段)，但使用者未啟用點心餐次時，智慧後援至「晚餐 (DINNER)」，避免誤分配為隔天早餐。
 * 3. 若找不到特定餐次，自動優先選用有效餐次清單中的合理項目。
 */
export function getCurrentDefaultMealType(
  availableMeals?: AvailableMealLike[],
  now: Date = new Date()
): MealType {
  // 若未傳入餐次清單，嘗試自 StorageService 同步讀取現有餐次
  let meals: AvailableMealLike[] = availableMeals && availableMeals.length > 0 ? availableMeals : [];
  if (meals.length === 0) {
    try {
      const stored = StorageService.getActiveMeals();
      if (stored && stored.length > 0) {
        meals = stored;
      }
    } catch {
      // 容錯降級
    }
  }

  const getMType = (m: AvailableMealLike): MealType => m.type || m.mealType || 'BREAKFAST';
  const getMName = (m: AvailableMealLike): string => m.name || m.customName || '';

  const hour = now.getHours();

  // 輔助函式：尋找餐別代碼或自訂名稱關鍵字
  const findMeal = (targetType: MealType, keywords: string[]): MealType | null => {
    // 1. 完全比對代碼
    const exact = meals.find((m) => getMType(m) === targetType);
    if (exact) return getMType(exact);

    // 2. 比對名稱關鍵字 (例如使用者將 MEAL_5 命名為「午餐」或「早午餐」)
    const byName = meals.find((m) => {
      const name = getMName(m);
      return keywords.some((kw) => name.includes(kw));
    });
    if (byName) return getMType(byName);

    return null;
  };

  // 1. 早餐 (04:00 - 10:59)
  if (hour >= 4 && hour < 11) {
    const matched = findMeal('BREAKFAST', ['早']);
    if (matched) return matched;
  }
  // 2. 午餐 (11:00 - 15:59)
  else if (hour >= 11 && hour < 16) {
    const matched = findMeal('LUNCH', ['午']);
    if (matched) return matched;
  }
  // 3. 晚餐 (16:00 - 20:59)
  else if (hour >= 16 && hour < 21) {
    const matched = findMeal('DINNER', ['晚']);
    if (matched) return matched;
  }
  // 4. 點心 / 宵夜時段 (21:00 - 03:59)
  else {
    const snackMatch = findMeal('SNACK', ['點', '宵', '消', '心']);
    if (snackMatch) return snackMatch;

    // 關鍵優化：若無點心/宵夜餐別，夜間 (21:00~23:59) 應智慧歸類為「晚餐」，絕不可誤跳為早餐
    if (hour >= 21) {
      const dinnerMatch = findMeal('DINNER', ['晚']);
      if (dinnerMatch) return dinnerMatch;
    } else {
      // 凌晨 (00:00~03:59) 若無宵夜，優先檢查晚餐，次之早餐
      const dinnerMatch = findMeal('DINNER', ['晚']);
      if (dinnerMatch) return dinnerMatch;
      const breakfastMatch = findMeal('BREAKFAST', ['早']);
      if (breakfastMatch) return breakfastMatch;
    }
  }

  // 若現有清單中找不到對應時段的項目，尋找最合理的預設
  if (meals.length > 0) {
    return getMType(meals[0]);
  }

  // 預設代碼兜底
  if (hour >= 4 && hour < 11) return 'BREAKFAST';
  if (hour >= 11 && hour < 16) return 'LUNCH';
  if (hour >= 16 && hour < 21) return 'DINNER';
  return 'SNACK';
}

/**
 * 取得時段提示文字（例如：「午餐 (依目前時段智慧預設)」）
 */
export function getTimeBasedMealSuggestionText(now: Date = new Date()): {
  mealType: MealType;
  suggestedName: string;
  timeSlotDescription: string;
} {
  const hour = now.getHours();
  if (hour >= 4 && hour < 11) {
    return { mealType: 'BREAKFAST', suggestedName: '早餐', timeSlotDescription: '早晨時段 (04:00-11:00)' };
  }
  if (hour >= 11 && hour < 16) {
    return { mealType: 'LUNCH', suggestedName: '午餐', timeSlotDescription: '午間時段 (11:00-16:00)' };
  }
  if (hour >= 16 && hour < 21) {
    return { mealType: 'DINNER', suggestedName: '晚餐', timeSlotDescription: '晚間時段 (16:00-21:00)' };
  }
  return { mealType: 'SNACK', suggestedName: '點心/宵夜', timeSlotDescription: '夜間時段 (21:00-04:00)' };
}
