import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Sliders,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import {
  CarbCycleType,
  CustomFood,
  FoodRecord,
  FoodSearchResult,
  MealConfig,
  MealType,
  NutritionGoalPreset,
} from '../types';
import { StorageService } from '../services/storage';
import { CARB_CYCLE_INFO } from '../data/defaults';
import { DateNavigator } from './DateNavigator';
import { AddFoodModal } from './AddFoodModal';
import { PortionModal } from './PortionModal';
import { CustomFoodModal } from './CustomFoodModal';
import { GoalSettingModal } from './GoalSettingModal';

interface DietTrackerProps {
  currentDate: string;
  onDateChange: (date: string) => void;
}

export const DietTracker: React.FC<DietTrackerProps> = ({
  currentDate,
  onDateChange,
}) => {
  // State
  const [foodRecords, setFoodRecords] = useState<FoodRecord[]>([]);
  const [activeMeals, setActiveMeals] = useState<MealConfig[]>([]);
  const [activeCycle, setActiveCycle] = useState<CarbCycleType>('MEDIUM');
  const [presets, setPresets] = useState<Record<CarbCycleType, NutritionGoalPreset>>(
    StorageService.getPresets()
  );

  // Modals state
  const [showAddFood, setShowAddFood] = useState(false);
  const [selectedMealForAdd, setSelectedMealForAdd] = useState<MealType>('BREAKFAST');
  const [foodForPortion, setFoodForPortion] = useState<FoodSearchResult | null>(null);
  const [showCustomFoodModal, setShowCustomFoodModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);

  // Collapsible meals state
  const [expandedMeals, setExpandedMeals] = useState<Record<string, boolean>>({
    BREAKFAST: true,
    LUNCH: true,
    DINNER: true,
    SNACK: true,
  });

  // Load day records & config
  const refreshRecords = () => {
    setFoodRecords(StorageService.getFoodRecordsByDate(currentDate));
    setActiveMeals(StorageService.getActiveMeals());
    setActiveCycle(StorageService.getActiveCarbCycle());
    setPresets(StorageService.getPresets());
  };

  useEffect(() => {
    refreshRecords();
  }, [currentDate]);

  // Current active goal preset
  const currentGoal = presets[activeCycle];

  // Calculate totals
  const totalCalories = foodRecords.reduce((sum, r) => sum + (r.calories || 0), 0);
  const totalCarbs = foodRecords.reduce((sum, r) => sum + (r.carbs || 0), 0);
  const totalProtein = foodRecords.reduce((sum, r) => sum + (r.protein || 0), 0);
  const totalFat = foodRecords.reduce((sum, r) => sum + (r.fat || 0), 0);
  const totalSugars = foodRecords.reduce((sum, r) => sum + (r.sugars || 0), 0);
  const totalFiber = foodRecords.reduce((sum, r) => sum + (r.fiber || 0), 0);
  const totalSodium = foodRecords.reduce((sum, r) => sum + (r.sodium || 0), 0);
  const totalPotassium = foodRecords.reduce((sum, r) => sum + (r.potassium || 0), 0);

  const calDiff = currentGoal.calories - totalCalories;
  const calPercent = Math.min(100, Math.round((totalCalories / (currentGoal.calories || 1)) * 100));

  // Change carb cycle
  const handleSelectCycle = (cycle: CarbCycleType) => {
    setActiveCycle(cycle);
    StorageService.setActiveCarbCycle(cycle);
  };

  // Delete item
  const handleDeleteRecord = (id: string) => {
    StorageService.deleteFoodRecord(id);
    refreshRecords();
  };

  // Clear entire meal
  const handleClearMeal = (mealType: string) => {
    if (window.confirm('確定要清空此餐點的所有紀錄嗎？')) {
      StorageService.deleteFoodRecordsByMeal(currentDate, mealType);
      refreshRecords();
    }
  };

  // Handle open add food modal
  const handleOpenAddFood = (mealType: MealType) => {
    setSelectedMealForAdd(mealType);
    setShowAddFood(true);
  };

  // Handle food selected from search
  const handleSelectFood = (food: FoodSearchResult) => {
    setShowAddFood(false);
    setFoodForPortion(food);
  };

  // Handle portion confirm
  const handleConfirmPortion = (record: FoodRecord) => {
    StorageService.saveFoodRecord(record);
    setFoodForPortion(null);
    refreshRecords();
  };

  // Handle save custom food
  const handleSaveCustomFood = (customFood: CustomFood) => {
    StorageService.saveCustomFood(customFood);
    // Open portion dialog with newly created food
    setFoodForPortion({
      id: customFood.id,
      name: customFood.name,
      brand: customFood.brand,
      caloriesPer100g: customFood.caloriesPer100g,
      carbsPer100g: customFood.carbsPer100g,
      proteinPer100g: customFood.proteinPer100g,
      fatPer100g: customFood.fatPer100g,
      sugarsPer100g: customFood.sugarsPer100g,
      fiberPer100g: customFood.fiberPer100g,
      sodiumPer100g: customFood.sodiumPer100g,
      potassiumPer100g: customFood.potassiumPer100g,
      defaultServingAmount: customFood.defaultServingAmount,
      servingUnit: customFood.servingUnit,
      servingSizeText: customFood.servingSizeText,
      isUserCustom: true,
    });
  };

  // Handle goal saved
  const handleSaveGoals = (newPresets: Record<CarbCycleType, NutritionGoalPreset>) => {
    setPresets(newPresets);
    StorageService.savePresets(newPresets);
  };

  const toggleExpand = (type: string) => {
    setExpandedMeals((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const cycles: CarbCycleType[] = ['HIGH', 'MEDIUM', 'LOW', 'CUSTOM'];

  return (
    <div className="space-y-4 pb-24 max-w-2xl mx-auto">
      {/* Date Navigator */}
      <DateNavigator currentDate={currentDate} onDateChange={onDateChange} />

      {/* Quick Search Entry */}
      <div
        onClick={() => handleOpenAddFood('BREAKFAST')}
        className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-2xs flex items-center gap-3 cursor-pointer hover:border-emerald-500 hover:shadow-xs transition"
      >
        <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
          <Search className="w-4 h-4" />
        </div>
        <span className="text-sm font-medium text-slate-400 flex-1">
          搜尋超商、官方資料庫或我的飲食...
        </span>
        <div className="flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100/70 px-2.5 py-1 rounded-lg">
          <Plus className="w-3.5 h-3.5" />
          <span>記錄</span>
        </div>
      </div>

      {/* Calorie & 7 Nutrients Summary Card */}
      <div className="bg-white rounded-3xl border border-emerald-950/5 shadow-sm p-5 space-y-4">
        {/* Top Carb Cycle Switcher Pills */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {cycles.map((c) => {
              const info = CARB_CYCLE_INFO[c];
              const isSelected = activeCycle === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleSelectCycle(c)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-emerald-800 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{info.emoji}</span>
                  <span>{info.shortName}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowGoalModal(true)}
            className="p-1.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition cursor-pointer"
            title="設定熱量與營養素目標"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>

        {/* Big Calorie Progress Display */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">今日攝取</div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-3xl font-black text-slate-900">{Math.round(totalCalories)}</span>
              <span className="text-sm font-semibold text-slate-400">/ {currentGoal.calories} kcal</span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {calDiff >= 0 ? '剩餘可攝取' : '超出預算'}
            </div>
            <div
              className={`text-2xl font-black mt-0.5 ${
                calDiff >= 0 ? 'text-emerald-700' : 'text-rose-600'
              }`}
            >
              {Math.abs(Math.round(calDiff))}{' '}
              <span className="text-xs font-semibold">kcal</span>
            </div>
          </div>
        </div>

        {/* Visual Calorie Bar */}
        <div className="space-y-1">
          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                calDiff >= 0 ? 'bg-emerald-600' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.min(100, calPercent)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-medium text-slate-400 px-0.5">
            <span>進度 {calPercent}%</span>
            <span>目標 {currentGoal.calories} kcal</span>
          </div>
        </div>

        {/* 3 Main Macros (Carbs, Protein, Fat) */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {/* Carbs */}
          <div className="bg-amber-50/60 border border-amber-200/50 p-2.5 rounded-2xl">
            <div className="flex items-center justify-between text-xs font-bold text-amber-800 mb-1">
              <span>碳水化合物</span>
              <span className="text-[10px] text-amber-600 font-semibold">
                {Math.round((totalCarbs / (currentGoal.carbs || 1)) * 100)}%
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-slate-900">{Math.round(totalCarbs)}</span>
              <span className="text-xs font-medium text-slate-400">/ {currentGoal.carbs}g</span>
            </div>
            <div className="w-full h-1.5 bg-amber-100 rounded-full mt-1.5 overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{
                  width: `${Math.min(100, (totalCarbs / (currentGoal.carbs || 1)) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Protein */}
          <div className="bg-blue-50/60 border border-blue-200/50 p-2.5 rounded-2xl">
            <div className="flex items-center justify-between text-xs font-bold text-blue-800 mb-1">
              <span>蛋白質</span>
              <span className="text-[10px] text-blue-600 font-semibold">
                {Math.round((totalProtein / (currentGoal.protein || 1)) * 100)}%
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-slate-900">{Math.round(totalProtein)}</span>
              <span className="text-xs font-medium text-slate-400">/ {currentGoal.protein}g</span>
            </div>
            <div className="w-full h-1.5 bg-blue-100 rounded-full mt-1.5 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{
                  width: `${Math.min(100, (totalProtein / (currentGoal.protein || 1)) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Fat */}
          <div className="bg-rose-50/60 border border-rose-200/50 p-2.5 rounded-2xl">
            <div className="flex items-center justify-between text-xs font-bold text-rose-800 mb-1">
              <span>脂肪</span>
              <span className="text-[10px] text-rose-600 font-semibold">
                {Math.round((totalFat / (currentGoal.fat || 1)) * 100)}%
              </span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-slate-900">{Math.round(totalFat)}</span>
              <span className="text-xs font-medium text-slate-400">/ {currentGoal.fat}g</span>
            </div>
            <div className="w-full h-1.5 bg-rose-100 rounded-full mt-1.5 overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full"
                style={{
                  width: `${Math.min(100, (totalFat / (currentGoal.fat || 1)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* 4 Micro Nutrients (Sugars, Fiber, Sodium, Potassium) */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
          <div className="p-1.5 bg-slate-50 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-semibold">糖分</span>
            <span className="font-bold text-slate-800">{Math.round(totalSugars)}g</span>
          </div>
          <div className="p-1.5 bg-slate-50 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-semibold">膳食纖維</span>
            <span className="font-bold text-slate-800">{Math.round(totalFiber)}g</span>
          </div>
          <div className="p-1.5 bg-slate-50 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-semibold">鈉含量</span>
            <span className="font-bold text-slate-800">
              {Math.round(totalSodium)} <span className="text-[9px]">mg</span>
            </span>
          </div>
          <div className="p-1.5 bg-slate-50 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-semibold">鉀含量</span>
            <span className="font-bold text-slate-800">
              {Math.round(totalPotassium)} <span className="text-[9px]">mg</span>
            </span>
          </div>
        </div>
      </div>

      {/* Meals Sections */}
      <div className="space-y-3">
        {activeMeals.map((meal) => {
          const mealRecords = foodRecords.filter((r) => r.mealType === meal.mealType);
          const mealCals = Math.round(mealRecords.reduce((s, r) => s + (r.calories || 0), 0));
          const mealP = Math.round(mealRecords.reduce((s, r) => s + (r.protein || 0), 0));
          const mealC = Math.round(mealRecords.reduce((s, r) => s + (r.carbs || 0), 0));
          const mealF = Math.round(mealRecords.reduce((s, r) => s + (r.fat || 0), 0));
          const isExpanded = expandedMeals[meal.mealType] ?? true;

          return (
            <div
              key={meal.mealType}
              className="bg-white rounded-3xl border border-slate-200/70 shadow-2xs overflow-hidden"
            >
              {/* Meal Header */}
              <div
                onClick={() => toggleExpand(meal.mealType)}
                className="px-5 py-3.5 flex items-center justify-between cursor-pointer hover:bg-slate-50/70 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="font-black text-base text-slate-900">{meal.customName}</span>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {mealCals} kcal
                  </span>
                  {mealRecords.length > 0 && (
                    <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                      碳 {mealC}g · 蛋 {mealP}g · 脂 {mealF}g
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenAddFood(meal.mealType);
                    }}
                    className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-xl transition cursor-pointer"
                    title="新增此餐飲食"
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  {mealRecords.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearMeal(meal.mealType);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                      title="清空此餐點"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <div className="text-slate-400 p-1">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </div>

              {/* Meal Item List */}
              {isExpanded && (
                <div className="px-5 pb-4 pt-1 border-t border-slate-100">
                  {mealRecords.length > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {mealRecords.map((item) => (
                        <div
                          key={item.id}
                          className="py-2.5 flex items-center justify-between gap-3 group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-sm text-slate-800 truncate">
                              {item.name}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                              <span className="font-semibold text-slate-600">
                                {item.amount}
                                {item.unit}
                              </span>
                              <span>·</span>
                              <span className="font-bold text-emerald-800">{item.calories} kcal</span>
                              <span className="text-[11px] text-amber-700">碳{item.carbs}g</span>
                              <span className="text-[11px] text-blue-700">蛋{item.protein}g</span>
                              <span className="text-[11px] text-rose-700">脂{item.fat}g</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteRecord(item.id)}
                            className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="刪除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      onClick={() => handleOpenAddFood(meal.mealType)}
                      className="py-3 text-center text-xs font-semibold text-slate-400 hover:text-emerald-700 cursor-pointer border border-dashed border-slate-200 hover:border-emerald-300 rounded-2xl mt-1 transition"
                    >
                      + 點擊記錄{meal.customName}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => handleOpenAddFood('BREAKFAST')}
        className="fixed bottom-20 right-5 z-30 flex items-center gap-2 px-5 py-3.5 bg-emerald-800 hover:bg-emerald-900 active:scale-95 text-white font-bold text-sm rounded-full shadow-lg transition cursor-pointer"
      >
        <Plus className="w-5 h-5" />
        <span>記錄飲食</span>
      </button>

      {/* Modals */}
      {showAddFood && (
        <AddFoodModal
          targetMeal={selectedMealForAdd}
          currentDate={currentDate}
          mealName={
            activeMeals.find((m) => m.mealType === selectedMealForAdd)?.customName || '餐點'
          }
          onClose={() => setShowAddFood(false)}
          onSelectFood={handleSelectFood}
          onOpenCustomFoodModal={() => {
            setShowAddFood(false);
            setShowCustomFoodModal(true);
          }}
        />
      )}

      {foodForPortion && (
        <PortionModal
          food={foodForPortion}
          targetMeal={selectedMealForAdd}
          currentDate={currentDate}
          onClose={() => setFoodForPortion(null)}
          onConfirm={handleConfirmPortion}
        />
      )}

      {showCustomFoodModal && (
        <CustomFoodModal
          onClose={() => setShowCustomFoodModal(false)}
          onSave={handleSaveCustomFood}
        />
      )}

      {showGoalModal && (
        <GoalSettingModal
          currentCycle={activeCycle}
          presets={presets}
          onClose={() => setShowGoalModal(false)}
          onSave={handleSaveGoals}
        />
      )}
    </div>
  );
};
