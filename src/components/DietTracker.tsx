import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Search,
  Sliders,
  Trash2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
  Camera,
  Loader2,
  Edit2,
  GripVertical,
} from 'lucide-react';
import { Reorder, useDragControls } from 'motion/react';
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
import { CloudFoodService } from '../services/cloudFoodService';
import { CARB_CYCLE_INFO } from '../data/defaults';
import { DateNavigator } from './DateNavigator';
import { AddFoodModal, FoodTab } from './AddFoodModal';
import { checkAiKeyOrWarn } from '../utils/aiHelper';
import { PortionModal } from './PortionModal';
import { CustomFoodModal } from './CustomFoodModal';
import { GoalSettingModal } from './GoalSettingModal';

interface DietTrackerProps {
  currentDate: string;
  onDateChange: (date: string) => void;
}

const MealSection: React.FC<{
  meal: MealConfig;
  mealRecords: FoodRecord[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onEditName: () => void;
  onAddFood: (tab?: FoodTab) => void;
  onClearMeal: () => void;
  onDeleteRecord: (id: string) => void;
  onEditRecord: (record: FoodRecord) => void;
}> = ({
  meal,
  mealRecords,
  isExpanded,
  onToggleExpand,
  onDelete,
  onEditName,
  onAddFood,
  onDeleteRecord,
  onEditRecord,
}) => {
  const dragControls = useDragControls();
  const mealCals = Math.round(mealRecords.reduce((s, r) => s + (r.calories || 0), 0));
  const mealP = Math.round(mealRecords.reduce((s, r) => s + (r.protein || 0), 0));
  const mealC = Math.round(mealRecords.reduce((s, r) => s + (r.carbs || 0), 0));
  const mealF = Math.round(mealRecords.reduce((s, r) => s + (r.fat || 0), 0));

  return (
    <Reorder.Item
      value={meal}
      dragListener={false}
      dragControls={dragControls}
      className="bg-white rounded-3xl border border-slate-200/70 shadow-2xs overflow-hidden list-none"
    >
      {/* Meal Header */}
      <div className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/70 transition">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="p-1.5 -ml-1.5 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 transition-colors touch-none"
            title="按住此處拖曳排序"
          >
            <GripVertical className="w-5 h-5" />
          </div>

          <div 
            className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 flex-1 min-w-0"
          >
            <div className="flex items-center gap-1.5">
              <span 
                onClick={onEditName}
                className="font-black text-base text-slate-900 truncate cursor-pointer hover:text-sky-700 transition-colors"
                title="點擊修改餐別名稱"
              >
                {meal.customName}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditName();
                }}
                className="p-1 text-slate-400 hover:text-sky-600 transition-colors cursor-pointer"
                title="修改名稱"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                {mealCals} kcal
              </span>
            </div>
            <div className="flex flex-col gap-1 cursor-pointer" onClick={onToggleExpand}>
              {mealRecords.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                    C: {mealC}g
                  </span>
                  <span className="text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                    P: {mealP}g
                  </span>
                  <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                    F: {mealF}g
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAddFood();
            }}
            className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition cursor-pointer"
            title="新增飲食"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
            title="刪除此餐次"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <div 
            className="text-slate-400 p-2 cursor-pointer" 
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* Meal Item List */}
      {isExpanded && (
        <div className="px-5 pb-4 pt-1 border-t border-slate-100">
          {mealRecords.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {mealRecords.map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 group">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800">
                      <span className="truncate">{item.name}</span>
                      {item.brand && <span className="text-xs font-medium text-slate-400 shrink-0">{item.brand}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span className="font-semibold text-sky-800">
                        {item.loggedAmount}{item.loggedUnit} , {item.calories} kcal
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.25 rounded-full">C: {item.carbs}g</span>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.25 rounded-full">P: {item.protein}g</span>
                        <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.25 rounded-full">F: {item.fat}g</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEditRecord(item)}
                      className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                      title="修改飲食內容"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRecord(item.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="刪除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              onClick={() => onAddFood()}
              className="py-4 text-center text-xs font-semibold text-slate-400 hover:text-sky-700 cursor-pointer border-2 border-dashed border-slate-100 hover:border-sky-200 rounded-2xl mt-1 transition-all"
            >
              + 點擊記錄 {meal.customName}
            </div>
          )}
        </div>
      )}
    </Reorder.Item>
  );
};

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

  // Direct AI Photo upload state
  const [isAiPhotoLoading, setIsAiPhotoLoading] = useState(false);
  const [aiPhotoError, setAiPhotoError] = useState('');
  const directCameraRef = useRef<HTMLInputElement>(null);
  const directPhotoMealTypeRef = useRef<MealType>('BREAKFAST');

  // Modals state
  const [showAddFood, setShowAddFood] = useState(false);
  const [addFoodInitialTab, setAddFoodInitialTab] = useState<FoodTab>('ALL');
  const [selectedMealForAdd, setSelectedMealForAdd] = useState<MealType>('BREAKFAST');
  const [foodForPortion, setFoodForPortion] = useState<FoodSearchResult | null>(null);
  const [showCustomFoodModal, setShowCustomFoodModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<FoodRecord | null>(null);
  const [aiReviewFood, setAiReviewFood] = useState<FoodSearchResult | null>(null);
  const [mealTypeToClear, setMealTypeToClear] = useState<string | null>(null);

  // Trigger direct camera capture
  const triggerDirectPhoto = (mealType: MealType = 'BREAKFAST') => {
    if (!checkAiKeyOrWarn()) return;
    setSelectedMealForAdd(mealType);
    directPhotoMealTypeRef.current = mealType;
    directCameraRef.current?.click();
  };

  const handleDirectPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAiPhotoLoading(true);
    setAiPhotoError('');

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      try {
        const userKey = StorageService.getGeminiApiKey();
        const model = StorageService.getSelectedAiModel();
        const res = await fetch('/api/ai/estimate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: base64,
            mimeType: file.type || 'image/jpeg',
            customApiKey: userKey,
            model,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || '照片辨識失敗');
        }

        const result = await res.json();
        const defaultAmount = Number(result.defaultServingAmount) || 200;
        const ratio = defaultAmount / 100;
        const calories = Math.round((Number(result.caloriesPer100g) || 150) * ratio * 10) / 10;
        const carbs = Math.round((Number(result.carbsPer100g) || 15) * ratio * 10) / 10;
        const protein = Math.round((Number(result.proteinPer100g) || 10) * ratio * 10) / 10;
        const fat = Math.round((Number(result.fatPer100g) || 5) * ratio * 10) / 10;
        const sugars = Math.round((Number(result.sugarsPer100g) || 0) * ratio * 10) / 10;
        const fiber = Math.round((Number(result.fiberPer100g) || 0) * ratio * 10) / 10;
        const sodium = Math.round((Number(result.sodiumPer100g) || 0) * ratio * 10) / 10;
        const potassium = Math.round((Number(result.potassiumPer100g) || 0) * ratio * 10) / 10;

        // Extract and normalize brand (e.g. 7-11, 全家, 萊爾富, OK) and barcode
        const rawBrand = result.brand ? String(result.brand).trim() : '';
        const normalizedBrand = rawBrand ? CloudFoodService.normalizeBrand(rawBrand) : '';
        const detectedBarcode = result.barcode ? String(result.barcode).trim() : undefined;

        const foodItem: FoodSearchResult = {
          id: 'ai_photo_' + Date.now(),
          name: result.name || '照片辨識料理',
          brand: normalizedBrand,
          barcode: detectedBarcode,
          calories,
          carbs,
          protein,
          fat,
          sugars,
          fiber,
          sodium,
          potassium,
          servingAmount: defaultAmount,
          servingUnit: result.servingUnit || 'g',
          servingSizeText: result.servingSizeText || `1份 (${defaultAmount}${result.servingUnit || 'g'})`,
          isUserCustom: true,
          aiSource: 'vision',
        };

        setAiReviewFood(foodItem);
      } catch (err: any) {
        setAiPhotoError(err.message || '無法辨識此照片，請嘗試重新拍攝');
      } finally {
        setIsAiPhotoLoading(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsDataURL(file);
  };

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

  // Custom modal states for iframe safety (replacing window.prompt / window.confirm)
  const [showAddMealModal, setShowAddMealModal] = useState(false);
  const [newMealNameInput, setNewMealNameInput] = useState('');
  const [editingMealState, setEditingMealState] = useState<{ mealType: string; customName: string } | null>(null);

  const handleOpenAddMealModal = () => {
    if (activeMeals.length >= 10) return;
    setNewMealNameInput(`新餐次 ${activeMeals.length + 1}`);
    setShowAddMealModal(true);
  };

  const handleConfirmAddMeal = () => {
    if (!newMealNameInput.trim()) return;
    const nextIndex = activeMeals.length + 1;
    const mealTypes: MealType[] = [
      'BREAKFAST',
      'LUNCH',
      'DINNER',
      'SNACK',
      'MEAL_5',
      'MEAL_6',
      'MEAL_7',
      'MEAL_8',
      'MEAL_9',
      'MEAL_10',
    ];
    
    const usedTypes = activeMeals.map(m => m.mealType);
    const nextType = mealTypes.find(t => !usedTypes.includes(t)) || (`MEAL_${nextIndex}` as MealType);
    
    const newMeal: MealConfig = {
      mealType: nextType,
      customName: newMealNameInput.trim(),
      isCustom: true,
    };
    const updated = [...activeMeals, newMeal];
    setActiveMeals(updated);
    StorageService.saveActiveMeals(updated);
    setShowAddMealModal(false);
    setNewMealNameInput('');
  };

  const handleDeleteMeal = (mealType: string) => {
    // Delete associated food records
    StorageService.deleteFoodRecordsByMeal(currentDate, mealType);
    
    const updated = activeMeals.filter((m) => m.mealType !== mealType);
    setActiveMeals(updated);
    StorageService.saveActiveMeals(updated);
    
    setExpandedMeals(prev => {
      const next = { ...prev };
      delete next[mealType];
      return next;
    });
    
    refreshRecords(); // Refresh to update UI
  };

  const handleOpenEditMealModal = (mealType: string, currentName: string) => {
    setEditingMealState({ mealType, customName: currentName });
  };

  const handleConfirmEditMeal = () => {
    if (!editingMealState) return;
    const { mealType, customName } = editingMealState;
    if (customName.trim()) {
      const updated = activeMeals.map(m => 
        m.mealType === mealType ? { ...m, customName: customName.trim() } : m
      );
      setActiveMeals(updated);
      StorageService.saveActiveMeals(updated);
    }
    setEditingMealState(null);
  };

  const handleReorderMeals = (newOrder: MealConfig[]) => {
    setActiveMeals(newOrder);
    StorageService.saveActiveMeals(newOrder);
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

  // Edit item
  const handleSaveEditRecord = (updated: FoodRecord) => {
    StorageService.saveFoodRecord(updated);
    setEditingRecord(null);
    refreshRecords();
  };

  // Clear entire meal
  const handleClearMeal = (mealType: string) => {
    setMealTypeToClear(mealType);
  };

  const confirmClearMeal = () => {
    if (mealTypeToClear) {
      StorageService.deleteFoodRecordsByMeal(currentDate, mealTypeToClear);
      refreshRecords();
      setMealTypeToClear(null);
    }
  };

  // Handle open add food modal
  const handleOpenAddFood = (mealType: MealType, initialTab: FoodTab = 'ALL') => {
    setSelectedMealForAdd(mealType);
    setAddFoodInitialTab(initialTab);
    setShowAddFood(true);
  };

  // Handle food selected from search
  const handleSelectFood = (food: FoodSearchResult, mealType?: MealType) => {
    if (mealType) {
      setSelectedMealForAdd(mealType);
    }
    setShowAddFood(false);
    if (food.id.startsWith('ai_')) {
      setAiReviewFood(food);
    } else {
      setFoodForPortion(food);
    }
  };

  // Handle portion confirm
  const handleConfirmPortion = (record: FoodRecord) => {
    StorageService.saveFoodRecord(record);
    setFoodForPortion(null);
    refreshRecords();
  };

  // Handle save custom food
  const handleSaveCustomFood = (customFood: CustomFood, consumedAmount: number) => {
    StorageService.saveCustomFood(customFood);
    
    const ratio = consumedAmount / (customFood.servingAmount || 1);
    const record: FoodRecord = {
      id: 'record_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: customFood.name,
      brand: customFood.brand,
      mealType: selectedMealForAdd!,
      date: currentDate,
      calories: Math.round(customFood.calories * ratio * 10) / 10,
      carbs: Math.round(customFood.carbs * ratio * 10) / 10,
      protein: Math.round(customFood.protein * ratio * 10) / 10,
      fat: Math.round(customFood.fat * ratio * 10) / 10,
      sugars: Math.round((customFood.sugars || 0) * ratio * 10) / 10,
      fiber: Math.round((customFood.fiber || 0) * ratio * 10) / 10,
      sodium: Math.round((customFood.sodium || 0) * ratio * 10) / 10,
      potassium: Math.round((customFood.potassium || 0) * ratio * 10) / 10,
      loggedAmount: consumedAmount,
      loggedUnit: customFood.servingUnit,
      createdAt: Date.now(),
    };
    StorageService.saveFoodRecord(record);
    setShowCustomFoodModal(false);
    refreshRecords();
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
      {/* Hidden camera file input */}
      <input
        type="file"
        ref={directCameraRef}
        accept="image/*"
        capture="environment"
        onChange={handleDirectPhotoUpload}
        className="hidden"
      />

      {/* Date Navigator */}
      <DateNavigator currentDate={currentDate} onDateChange={onDateChange} />

      {/* Primary Smart Entry Bar */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="w-5 h-5 text-slate-400 group-focus-within:text-sky-500 transition-colors" />
        </div>
        <input
          type="text"
          readOnly
          onClick={() => handleOpenAddFood('BREAKFAST')}
          placeholder="點擊搜尋、拍照或 AI 智慧辨識..."
          className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200/80 rounded-2xl shadow-sm text-sm font-bold text-slate-700 focus:outline-none cursor-pointer hover:border-sky-400 hover:shadow-md transition-all"
        />
        <div className="absolute inset-y-0 right-3 flex items-center">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 p-1 rounded-xl">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!checkAiKeyOrWarn()) return;
                handleOpenAddFood('BREAKFAST', 'AI_SCAN');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-purple-700 hover:bg-purple-50 rounded-lg transition font-black text-[10px] shadow-2xs active:scale-95 border border-purple-100"
            >
              <Sparkles className="w-3 h-3" />
              <span>AI 智慧搜尋</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI Photo Processing Banner */}
      {isAiPhotoLoading && (
        <div className="bg-purple-700 text-white p-4 rounded-2xl shadow-md flex items-center gap-3 animate-pulse">
          <Loader2 className="w-6 h-6 animate-spin shrink-0 text-purple-200" />
          <div className="flex-1">
            <div className="font-bold text-sm">Gemini 營養師 AI 視覺辨識中...</div>
            <div className="text-xs text-purple-200 mt-0.5">
              正在自動辨識餐點成分、計算卡路里與三大營養素...
            </div>
          </div>
        </div>
      )}

      {/* AI Photo Error Banner */}
      {aiPhotoError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-2xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{aiPhotoError}</span>
          </div>
          <button
            onClick={() => setAiPhotoError('')}
            className="text-rose-500 hover:text-rose-800 font-bold cursor-pointer"
          >
            關閉
          </button>
        </div>
      )}

      {/* Calorie & 7 Nutrients Summary Card */}
      <div className="bg-white rounded-3xl border border-sky-950/5 shadow-sm p-5 space-y-4">
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
                      ? 'bg-sky-600 text-white shadow-2xs'
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
            className="p-1.5 text-slate-400 hover:text-sky-700 hover:bg-sky-50 rounded-xl transition cursor-pointer"
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
                calDiff >= 0 ? 'text-sky-700' : 'text-rose-600'
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
                calDiff >= 0 ? 'bg-sky-500' : 'bg-rose-500'
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
              <span>C (碳水)</span>
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
              <span>P (蛋白)</span>
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
              <span>F (脂肪)</span>
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
      <Reorder.Group
        axis="y"
        values={activeMeals}
        onReorder={handleReorderMeals}
        className="space-y-3"
      >
        {activeMeals.map((meal) => (
          <MealSection
            key={meal.mealType}
            meal={meal}
            mealRecords={foodRecords.filter((r) => r.mealType === meal.mealType)}
            isExpanded={expandedMeals[meal.mealType] ?? true}
            onToggleExpand={() => toggleExpand(meal.mealType)}
            onDelete={() => handleDeleteMeal(meal.mealType)}
            onEditName={() => handleOpenEditMealModal(meal.mealType, meal.customName)}
            onAddFood={(tab) => handleOpenAddFood(meal.mealType, tab)}
            onClearMeal={() => handleClearMeal(meal.mealType)}
            onDeleteRecord={handleDeleteRecord}
            onEditRecord={setEditingRecord}
          />
        ))}
      </Reorder.Group>

      {/* Add Meal Button */}
      {activeMeals.length < 10 && (
        <button
          type="button"
          onClick={handleOpenAddMealModal}
          className="w-full py-5 border-2 border-dashed border-slate-200 rounded-3xl text-sm font-black text-slate-400 hover:border-sky-400 hover:text-sky-800 hover:bg-sky-50/30 transition flex items-center justify-center gap-2 cursor-pointer group"
        >
          <Plus className="w-5 h-5 group-hover:scale-110 transition" />
          <span>新增自訂餐次 (最多 10 個)</span>
        </button>
      )}

      {/* Modals */}
      {showAddFood && (
        <AddFoodModal
          initialMealType={selectedMealForAdd}
          availableMeals={activeMeals.map(m => ({ type: m.mealType, name: m.customName }))}
          currentDate={currentDate}
          initialTab={addFoodInitialTab}
          onClose={() => setShowAddFood(false)}
          onSelectFood={(food, mealType) => handleSelectFood(food, mealType)}
          onOpenCustomFoodModal={() => {
            setShowAddFood(false);
            setShowCustomFoodModal(true);
          }}
        />
      )}

      {foodForPortion && (
        <CustomFoodModal
          mode="ADD_RECORD"
          initialFood={{
             id: foodForPortion.id,
             name: foodForPortion.name,
             brand: foodForPortion.brand || '',
             calories: foodForPortion.calories,
             carbs: foodForPortion.carbs,
             protein: foodForPortion.protein,
             fat: foodForPortion.fat,
             sugars: foodForPortion.sugars,
             fiber: foodForPortion.fiber,
             sodium: foodForPortion.sodium,
             potassium: foodForPortion.potassium,
             servingAmount: foodForPortion.servingAmount || 100,
             servingUnit: foodForPortion.servingUnit || 'g',
             updatedAt: Date.now(),
          }}
          initialConsumedAmount={foodForPortion.servingAmount || 100}
          onClose={() => setFoodForPortion(null)}
          onSave={(food, consumedAmount) => {
             const ratio = consumedAmount / (food.servingAmount || 1);
             const record: FoodRecord = {
                id: 'record_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                name: food.name,
                brand: food.brand,
                mealType: selectedMealForAdd!,
                date: currentDate,
                calories: Math.round(food.calories * ratio * 10) / 10,
                carbs: Math.round(food.carbs * ratio * 10) / 10,
                protein: Math.round(food.protein * ratio * 10) / 10,
                fat: Math.round(food.fat * ratio * 10) / 10,
                sugars: Math.round((food.sugars || 0) * ratio * 10) / 10,
                fiber: Math.round((food.fiber || 0) * ratio * 10) / 10,
                sodium: Math.round((food.sodium || 0) * ratio * 10) / 10,
                potassium: Math.round((food.potassium || 0) * ratio * 10) / 10,
                loggedAmount: consumedAmount,
                loggedUnit: food.servingUnit,
                createdAt: Date.now(),
             };
             StorageService.saveFoodRecord(record);
             setFoodForPortion(null);
             refreshRecords();
          }}
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

      {aiReviewFood && (
        <CustomFoodModal
          mode="AI_REVIEW"
          initialFood={{
             id: aiReviewFood.id,
             name: aiReviewFood.name,
             brand: aiReviewFood.brand,
             barcode: aiReviewFood.barcode,
             calories: aiReviewFood.calories,
             carbs: aiReviewFood.carbs,
             protein: aiReviewFood.protein,
             fat: aiReviewFood.fat,
             sugars: aiReviewFood.sugars,
             fiber: aiReviewFood.fiber,
             sodium: aiReviewFood.sodium,
             potassium: aiReviewFood.potassium,
             servingAmount: aiReviewFood.servingAmount || 100,
             servingUnit: aiReviewFood.servingUnit || 'g',
             updatedAt: Date.now(),
          }}
          initialConsumedAmount={aiReviewFood.servingAmount || 100}
          onClose={() => setAiReviewFood(null)}
          onSave={(food, consumedAmount) => {
             // 1. Save to custom foods preset
             StorageService.saveCustomFood(food);
             // 2. Add as a food record
             const ratio = consumedAmount / (food.servingAmount || 1);
             const record: FoodRecord = {
                id: 'record_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                name: food.name,
                brand: food.brand,
                barcode: food.barcode,
                mealType: selectedMealForAdd!,
                date: currentDate,
                calories: Math.round(food.calories * ratio * 10) / 10,
                carbs: Math.round(food.carbs * ratio * 10) / 10,
                protein: Math.round(food.protein * ratio * 10) / 10,
                fat: Math.round(food.fat * ratio * 10) / 10,
                sugars: Math.round((food.sugars || 0) * ratio * 10) / 10,
                fiber: Math.round((food.fiber || 0) * ratio * 10) / 10,
                sodium: Math.round((food.sodium || 0) * ratio * 10) / 10,
                potassium: Math.round((food.potassium || 0) * ratio * 10) / 10,
                loggedAmount: consumedAmount,
                loggedUnit: food.servingUnit,
                createdAt: Date.now(),
             };
             StorageService.saveFoodRecord(record);
             setAiReviewFood(null);
             refreshRecords();
          }}
        />
      )}

      {editingRecord && (
        <CustomFoodModal
          mode="EDIT_RECORD"
          initialFood={{
             id: editingRecord.id,
             name: editingRecord.name,
             brand: editingRecord.brand || '',
             calories: editingRecord.calories,
             carbs: editingRecord.carbs,
             protein: editingRecord.protein,
             fat: editingRecord.fat,
             sugars: editingRecord.sugars,
             fiber: editingRecord.fiber,
             sodium: editingRecord.sodium,
             potassium: editingRecord.potassium,
             servingAmount: editingRecord.loggedAmount,
             servingUnit: editingRecord.loggedUnit,
             barcode: editingRecord.barcode,
             updatedAt: Date.now(),
          }}
          initialConsumedAmount={editingRecord.loggedAmount}
          onClose={() => setEditingRecord(null)}
          onSave={(food, consumedAmount) => {
             const ratio = consumedAmount / (food.servingAmount || 1);
             const record: FoodRecord = {
                ...editingRecord,
                name: food.name,
                brand: food.brand,
                calories: Math.round(food.calories * ratio * 10) / 10,
                carbs: Math.round(food.carbs * ratio * 10) / 10,
                protein: Math.round(food.protein * ratio * 10) / 10,
                fat: Math.round(food.fat * ratio * 10) / 10,
                sugars: Math.round((food.sugars || 0) * ratio * 10) / 10,
                fiber: Math.round((food.fiber || 0) * ratio * 10) / 10,
                sodium: Math.round((food.sodium || 0) * ratio * 10) / 10,
                potassium: Math.round((food.potassium || 0) * ratio * 10) / 10,
                loggedAmount: consumedAmount,
                loggedUnit: food.servingUnit,
                barcode: food.barcode,
             };
             StorageService.saveFoodRecord(record);
             setEditingRecord(null);
             refreshRecords();
          }}
        />
      )}

      {/* Add Meal Custom Modal */}
      {showAddMealModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-slate-900">新增自訂餐次</h3>
            <p className="text-xs text-slate-500">請輸入餐次名稱（例如：下午茶、訓練前餐、宵夜）</p>
            <input
              type="text"
              value={newMealNameInput}
              onChange={(e) => setNewMealNameInput(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
              placeholder="請輸入餐次名稱"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmAddMeal(); }}
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddMealModal(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-2xl transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmAddMeal}
                className="flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-2xl transition cursor-pointer shadow-sm"
              >
                確認新增
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Meal Name Custom Modal */}
      {editingMealState && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-slate-900">修改餐別名稱</h3>
            <p className="text-xs text-slate-500">請輸入新的餐次名稱</p>
            <input
              type="text"
              value={editingMealState.customName}
              onChange={(e) => setEditingMealState({ ...editingMealState, customName: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:border-sky-500"
              placeholder="餐次名稱"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirmEditMeal(); }}
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingMealState(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-2xl transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirmEditMeal}
                className="flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-2xl transition cursor-pointer shadow-sm"
              >
                儲存修改
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Meal Confirm Modal */}
      {mealTypeToClear && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-black text-slate-900">清空餐點紀錄</h3>
            <p className="text-sm text-slate-500">確定要清空此餐點的所有飲食紀錄嗎？此動作將無法復原。</p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMealTypeToClear(null)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-2xl transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmClearMeal}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm rounded-2xl transition cursor-pointer shadow-sm"
              >
                確定清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
