import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Sparkles, AlertCircle, ChevronDown, CloudUpload, AlertTriangle, CheckCircle2, Plus, Minus } from 'lucide-react';
import { CloudFood, CustomFood } from '../types';
import { MacroCalorieVerifier } from './MacroCalorieVerifier';
import { CloudFoodService, isTfdaFood, normalizeBrandName } from '../services/cloudFoodService';

interface CustomFoodModalProps {
  onClose: () => void;
  onSave: (food: CustomFood, consumedAmount: number) => void;
  initialFood?: CustomFood;
  initialConsumedAmount?: number;
  mode?: "CUSTOM" | "EDIT_RECORD" | "AI_REVIEW" | "ADD_RECORD";
}

const isAllFieldsIdentical = (food: CustomFood, existing: CloudFood): boolean => {
  const normStr = (s?: string) => (s || '').trim().toLowerCase();
  const numEq = (n1?: number, n2?: number) => {
    const v1 = Number(n1 || 0);
    const v2 = Number(n2 || 0);
    return Math.abs(v1 - v2) < 0.01;
  };

  if (normStr(food.name) !== normStr(existing.name)) return false;
  if (normStr(food.brand) !== normStr(existing.brand)) return false;
  if (normStr(food.servingUnit) !== normStr(existing.servingUnit)) return false;
  if (normStr(food.barcode) !== normStr(existing.barcode)) return false;

  if (!numEq(food.servingAmount, existing.servingAmount)) return false;
  if (!numEq(food.calories, existing.calories)) return false;
  if (!numEq(food.carbs, existing.carbs)) return false;
  if (!numEq(food.protein, existing.protein)) return false;
  if (!numEq(food.fat, existing.fat)) return false;
  if (!numEq(food.sugars, existing.sugars)) return false;
  if (!numEq(food.fiber, existing.fiber)) return false;
  if (!numEq(food.sodium, existing.sodium)) return false;
  if (!numEq(food.potassium, existing.potassium)) return false;

  return true;
};

export const CustomFoodModal: React.FC<CustomFoodModalProps> = ({
  onClose,
  onSave,
  initialFood,
  initialConsumedAmount,
  mode = "CUSTOM",
}) => {
  const [name, setName] = useState(initialFood?.name || '');
  const [brand, setBrand] = useState(() => {
    if (initialFood?.brand) return initialFood.brand;
    if (mode === 'AI_REVIEW' || initialFood?.id?.startsWith('ai_')) return 'AI辨識';
    return '';
  });
  const [calories, setCalories] = useState<number | string>(initialFood?.calories ?? '');
  const [carbs, setCarbs] = useState<number | string>(initialFood?.carbs ?? '');
  const [protein, setProtein] = useState<number | string>(initialFood?.protein ?? '');
  const [fat, setFat] = useState<number | string>(initialFood?.fat ?? '');
  const [sugars, setSugars] = useState<number | string>(initialFood?.sugars ?? '');
  const [fiber, setFiber] = useState<number | string>(initialFood?.fiber ?? '');
  const [sodium, setSodium] = useState<number | string>(initialFood?.sodium ?? '');
  const [potassium, setPotassium] = useState<number | string>(initialFood?.potassium ?? '');
  
  // 食品份量：固定基準值（唯讀或於新增自訂時設定）
  const [servingAmount, setServingAmount] = useState<number | string>(initialFood?.servingAmount || 100);
  // 食用份量：動態變數
  const [consumedAmount, setConsumedAmount] = useState<number | string>(initialConsumedAmount ?? initialFood?.servingAmount ?? 100);
  const [servingUnit, setServingUnit] = useState<string>(initialFood?.servingUnit || 'g');
  const [barcode, setBarcode] = useState<string>(initialFood?.barcode || '');

  // 份量輸入：動態變數（可手動輸入、微調或由卡片帶入）
  const [portionInput, setPortionInput] = useState<number | string>(() => {
    const base = Number(initialFood?.servingAmount) || 100;
    const initialC = initialConsumedAmount !== undefined && initialConsumedAmount !== null
      ? Number(initialConsumedAmount)
      : base;
    if (base > 0 && !isNaN(initialC)) {
      return Math.round((initialC / base) * 10) / 10;
    }
    return 1;
  });
  
  const isOfficialTfda = isTfdaFood({ id: initialFood?.id, brand });
  const [shareToCloud, setShareToCloud] = useState<boolean>(() => {
    const initFoodObj = initialFood || { brand: brand || '' };
    if (isTfdaFood(initFoodObj)) {
      return false;
    }
    return initialFood?.isSharedToCloud !== undefined ? initialFood.isSharedToCloud : true;
  });
  const [isSharing, setIsSharing] = useState<boolean>(false);

  const foodInitKey = initialFood
    ? `${initialFood.id || ''}_${initialFood.name || ''}_${initialConsumedAmount ?? ''}_${mode}`
    : '';

  useEffect(() => {
    if (initialFood) {
      setName(initialFood.name || '');
      const b = initialFood.brand || ((mode === 'AI_REVIEW' || initialFood.id?.startsWith('ai_')) ? 'AI辨識' : '');
      setBrand(b);
      setCalories(initialFood.calories ?? '');
      setCarbs(initialFood.carbs ?? '');
      setProtein(initialFood.protein ?? '');
      setFat(initialFood.fat ?? '');
      setSugars(initialFood.sugars ?? '');
      setFiber(initialFood.fiber ?? '');
      setSodium(initialFood.sodium ?? '');
      setPotassium(initialFood.potassium ?? '');
      const base = Number(initialFood.servingAmount) || 100;
      setServingAmount(base);
      setServingUnit(initialFood.servingUnit || 'g');
      setBarcode(initialFood.barcode || '');

      const initialC = (initialConsumedAmount !== undefined && initialConsumedAmount !== null && Number(initialConsumedAmount) > 0)
        ? Number(initialConsumedAmount)
        : base;
      setConsumedAmount(initialC);
      if (base > 0 && !isNaN(initialC)) {
        setPortionInput(Math.round((initialC / base) * 10) / 10);
      } else {
        setPortionInput(1);
      }
    }
  }, [foodInitKey]);

  const handleBrandChange = (newBrand: string) => {
    setBrand(newBrand);
    const willBeTfda = isTfdaFood({ id: initialFood?.id, brand: newBrand });
    if (willBeTfda) {
      setShareToCloud(false);
    } else {
      setShareToCloud(true);
    }
  };
  
  // Duplicate check dialog state
  const [duplicateModal, setDuplicateModal] = useState<{
    show: boolean;
    existingFood: CloudFood;
    pendingFood: CustomFood;
    pendingConsumedAmount: number;
  } | null>(null);

  const [error, setError] = useState<string>('');
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);

  const unitOptions = [
    { value: 'g', label: 'g (公克)' },
    { value: 'ml', label: 'ml (毫升)' },
    { value: '個', label: '個' },
    { value: '份', label: '份' },
    { value: '碗', label: '碗' },
    { value: '杯', label: '杯' },
    { value: '包', label: '包' },
    { value: '瓶', label: '瓶' },
  ];

  // Auto calculate calories from macros helper
  const handleAutoCalcCalories = () => {
    const calc = Math.round((Number(carbs) * 4 + Number(protein) * 4 + Number(fat) * 9) * 10) / 10;
    setCalories(calc);
  };

  const executeSave = (foodToSave: CustomFood, consumed: number, doUpload: boolean) => {
    // 1. If user chose to share to cloud and it's not TFDA, run upload in the background (fire-and-forget)
    if (doUpload && !isTfdaFood(foodToSave)) {
      CloudFoodService.uploadInBackground(foodToSave);
    }

    // 2. Immediately persist locally and close modal without delay
    onSave(foodToSave, consumed);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('請輸入食品名稱');
      return;
    }
    
    const parsedDefault = Number(servingAmount) || 100;
    const parsedConsumed = Number(consumedAmount) || 100;

    // Normalize brand (e.g. 7-11, 全家, 萊爾富, OK)
    // If empty: in AI_REVIEW mode default to 'AI辨識', otherwise default to '自訂'
    const trimmedBrand = brand.trim();
    let finalBrand = trimmedBrand;
    if (!finalBrand) {
      if (mode === 'AI_REVIEW' || initialFood?.id?.startsWith('ai_')) {
        finalBrand = 'AI辨識';
      } else {
        finalBrand = '自訂';
      }
    }
    const normalizedBrand = normalizeBrandName(finalBrand);

    const food: CustomFood = {
      id: initialFood?.id || 'custom_' + Date.now(),
      name: name.trim(),
      brand: normalizedBrand,
      servingAmount: parsedDefault,
      servingUnit: servingUnit || 'g',
      calories: Number(calories) || 0,
      carbs: Number(carbs) || 0,
      protein: Number(protein) || 0,
      fat: Number(fat) || 0,
      sugars: Number(sugars) || 0,
      fiber: Number(fiber) || 0,
      sodium: Number(sodium) || 0,
      potassium: Number(potassium) || 0,
      barcode: barcode.trim() || undefined,
      updatedAt: Date.now(),
      isSharedToCloud: shareToCloud && !isTfdaFood({ id: initialFood?.id, brand: normalizedBrand }),
    };

    // If uploading to cloud, perform duplicate pre-check
    if (food.isSharedToCloud) {
      setIsSharing(true);
      try {
        const preCheck = await CloudFoodService.preCheckCloudFood({
          name: food.name,
          brand: food.brand,
          servingUnit: food.servingUnit,
        });

        if (preCheck.exists && preCheck.existingFood) {
          setIsSharing(false);
          const isIdentical = isAllFieldsIdentical(food, preCheck.existingFood);
          if (!isIdentical) {
            // Show duplicate resolution dialog only if fields differ
            setDuplicateModal({
              show: true,
              existingFood: preCheck.existingFood,
              pendingFood: food,
              pendingConsumedAmount: parsedConsumed,
            });
            return;
          }
        }
      } catch (checkErr) {
        console.warn('Pre-check failed, continuing:', checkErr);
      } finally {
        setIsSharing(false);
      }
    }

    await executeSave(food, parsedConsumed, !!food.isSharedToCloud);
  };

  const isManualMode = mode === 'CUSTOM';

  // 正向計算：修改「份量輸入」（手動輸入、微調 +/- 或點擊卡片）時，即時更新「食用份量 = 份量輸入 × 食品份量」
  const updateFromPortionInput = (rawVal: string | number) => {
    setPortionInput(rawVal);
    if (rawVal === '' || rawVal === null || rawVal === undefined) {
      setConsumedAmount('');
      return;
    }
    const portionNum = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal);
    const baseServing = Number(servingAmount) || 0;

    // 容錯機制：若非數字、小於 0 或食品份量為 0 時，預設帶入 0
    if (isNaN(portionNum) || portionNum < 0 || baseServing <= 0) {
      setConsumedAmount(0);
      return;
    }

    // 食用份量 = 份量輸入 × 食品份量 (四捨五入至小數點後第 1 位)
    const calculatedConsumed = Math.round(portionNum * baseServing * 10) / 10;
    setConsumedAmount(calculatedConsumed);
  };

  // 反向計算：手動修改「食用份量」時，即時倒推更新「份量輸入 = 食用份量 / 食品份量」（結果四捨五入至小數點後第 1 位）
  const updateFromConsumedAmount = (rawVal: string | number) => {
    setConsumedAmount(rawVal);
    if (rawVal === '' || rawVal === null || rawVal === undefined) {
      setPortionInput('');
      return;
    }
    const consumedNum = typeof rawVal === 'number' ? rawVal : parseFloat(rawVal);
    const baseServing = Number(servingAmount) || 0;

    // 容錯機制：若非數字、小於 0 或食品份量為 0 時，預設帶入 0（防止除以零錯誤）
    if (isNaN(consumedNum) || consumedNum < 0 || baseServing <= 0) {
      setPortionInput(0);
      return;
    }

    // 份量輸入 = 食用份量 / 食品份量
    const calculatedPortion = Math.round((consumedNum / baseServing) * 10) / 10;
    setPortionInput(calculatedPortion);
  };

  // 微調按鈕：點擊 + / - 時，調整單位幅度為 0.1（最小值限制為 0）
  const handleStepPortion = (delta: number) => {
    const current = parseFloat(String(portionInput)) || 0;
    const next = Math.max(0, Math.round((current + delta) * 10) / 10);
    updateFromPortionInput(next);
  };

  // 自訂食材模式下修改基準食品份量時的連動
  const handleServingAmountChange = (rawVal: string) => {
    setServingAmount(rawVal);
    const baseServing = parseFloat(rawVal);
    const portionNum = parseFloat(String(portionInput));
    if (!isNaN(baseServing) && baseServing > 0 && !isNaN(portionNum)) {
      setConsumedAmount(Math.round(portionNum * baseServing * 10) / 10);
    }
  };

  // Helper Sections
  const renderConsumedAmountSection = (uniqueKey: string) => {
    const unitLabel = unitOptions.find(o => o.value === servingUnit)?.label || servingUnit;
    const baseServing = Number(servingAmount) || 0;

    return (
      <div key={uniqueKey} className="bg-sky-50/60 border border-sky-100 p-3.5 rounded-2xl space-y-3">
        {/* 基準食品份量指示 (唯讀固定基準值提示) */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700">份量與食用量換算</span>
          <span className="text-[11px] font-semibold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-md">
            食品份量基準：{baseServing} {unitLabel}
          </span>
        </div>

        {/* 1. 份量輸入欄位 (在食用份量上方) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            份量輸入 <span className="text-slate-400 font-normal">（依每份基準計算倍數）</span>
          </label>
          <div className="flex items-center gap-2">
            {/* - 微調按鈕 */}
            <button
              type="button"
              onClick={() => handleStepPortion(-0.1)}
              className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 active:scale-95 text-slate-700 font-black text-lg flex items-center justify-center transition cursor-pointer select-none shadow-2xs shrink-0"
              title="減少 0.1 份"
            >
              <Minus className="w-4 h-4" />
            </button>

            {/* 數字輸入框 */}
            <div className="relative flex-1">
              <input
                type="number"
                step="0.1"
                min="0"
                value={portionInput}
                onChange={(e) => updateFromPortionInput(e.target.value)}
                placeholder="1"
                className="w-full text-center px-3 py-2 rounded-xl border border-slate-200 font-bold text-slate-800 bg-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                份
              </span>
            </div>

            {/* + 微調按鈕 */}
            <button
              type="button"
              onClick={() => handleStepPortion(0.1)}
              className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 active:scale-95 text-slate-700 font-black text-lg flex items-center justify-center transition cursor-pointer select-none shadow-2xs shrink-0"
              title="增加 0.1 份"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. 快速帶入卡片 (在份量輸入下方、食用份量上方) */}
        <div>
          <div className="text-[11px] font-semibold text-slate-500 mb-1.5">快速份量選擇</div>
          <div className="grid grid-cols-4 gap-2">
            {[0.5, 1, 1.5, 2].map((opt) => {
              const isSelected = Number(portionInput) === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => updateFromPortionInput(opt)}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all cursor-pointer select-none border ${
                    isSelected
                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-sky-50 hover:text-sky-700 border-slate-200 shadow-2xs'
                  }`}
                >
                  {opt} 份
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. 食用份量輸入框 (正向/反向雙向即時運算) */}
        <div className="pt-1 border-t border-sky-100/60">
          <label className="block text-xs font-semibold text-sky-800 mb-1.5">
            食用份量 (將以此數值加入紀錄) <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              step="any"
              min="0"
              value={consumedAmount}
              onChange={(e) => updateFromConsumedAmount(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-sky-300 font-bold text-sky-900 bg-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors shadow-2xs"
              placeholder="0"
            />
            <div className="flex items-center px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 font-bold text-sm">
              {unitLabel}
            </div>
          </div>
        </div>

        {/* 4. 食用份量快速帶入卡片 (在食用份量下方) */}
        <div>
          <div className="text-[11px] font-semibold text-slate-500 mb-1.5">快速食用量選擇</div>
          <div className="grid grid-cols-4 gap-2">
            {(() => {
              const isGramOrMl = servingUnit === 'g' || servingUnit === 'ml' || servingUnit === '公克' || servingUnit === '毫升';
              const options: number[] = isGramOrMl
                ? [50, 100, 150, 200]
                : baseServing <= 1
                  ? [1, 2, 3, 4]
                  : [
                      Math.round(baseServing * 0.5 * 10) / 10,
                      Math.round(baseServing * 1 * 10) / 10,
                      Math.round(baseServing * 1.5 * 10) / 10,
                      Math.round(baseServing * 2 * 10) / 10,
                    ];

              return options.map((opt) => {
                const isSelected = Number(consumedAmount) === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => updateFromConsumedAmount(opt)}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all cursor-pointer select-none border whitespace-nowrap ${
                      isSelected
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                        : 'bg-white text-slate-700 hover:bg-sky-50 hover:text-sky-700 border-slate-200 shadow-2xs'
                    }`}
                  >
                    {opt}{isGramOrMl ? servingUnit : ` ${servingUnit}`}
                  </button>
                );
              });
            })()}
          </div>
        </div>
      </div>
    );
  };

  const renderPreviewSection = (uniqueKey: string) => (
    <div key={uniqueKey} className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
      <div className="text-xs text-slate-500 mb-2 font-medium">實際攝取營養預覽：</div>
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-[10px] text-slate-500 mb-0.5 font-bold">熱量</div>
          <div className="font-bold text-slate-800">
            {Math.round((Number(calories) || 0) * ((Number(consumedAmount) || 0) / (Number(servingAmount) || 1)) * 10) / 10}
          </div>
        </div>
        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-[10px] text-amber-600 mb-0.5 font-bold">碳水</div>
          <div className="font-bold text-slate-800">
            {Math.round((Number(carbs) || 0) * ((Number(consumedAmount) || 0) / (Number(servingAmount) || 1)) * 10) / 10}
          </div>
        </div>
        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-[10px] text-blue-600 mb-0.5 font-bold">蛋白質</div>
          <div className="font-bold text-slate-800">
            {Math.round((Number(protein) || 0) * ((Number(consumedAmount) || 0) / (Number(servingAmount) || 1)) * 10) / 10}
          </div>
        </div>
        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-[10px] text-rose-600 mb-0.5 font-bold">脂肪</div>
          <div className="font-bold text-slate-800">
            {Math.round((Number(fat) || 0) * ((Number(consumedAmount) || 0) / (Number(servingAmount) || 1)) * 10) / 10}
          </div>
        </div>
        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-[10px] text-orange-500 mb-0.5 font-bold">糖</div>
          <div className="font-bold text-slate-800">
            {Math.round((Number(sugars) || 0) * ((Number(consumedAmount) || 0) / (Number(servingAmount) || 1)) * 10) / 10}
          </div>
        </div>
        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-[10px] text-slate-400 mb-0.5 font-bold">纖維</div>
          <div className="font-bold text-slate-800">
            {Math.round((Number(fiber) || 0) * ((Number(consumedAmount) || 0) / (Number(servingAmount) || 1)) * 10) / 10}
          </div>
        </div>
        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-[10px] text-indigo-500 mb-0.5 font-bold">鈉</div>
          <div className="font-bold text-slate-800 text-[10px]">
            {Math.round((Number(sodium) || 0) * ((Number(consumedAmount) || 0) / (Number(servingAmount) || 1)) * 10) / 10}
          </div>
        </div>
        <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-[10px] text-cyan-500 mb-0.5 font-bold">鉀</div>
          <div className="font-bold text-slate-800 text-[10px]">
            {Math.round((Number(potassium) || 0) * ((Number(consumedAmount) || 0) / (Number(servingAmount) || 1)) * 10) / 10}
          </div>
        </div>
      </div>
    </div>
  );

  const renderServingAmountSection = () => (
    <div className="pt-2 border-t border-slate-100">
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-semibold text-slate-700">每份份量 (基準食品份量)</label>
        {!isManualMode && (
          <span className="text-[10px] text-slate-400 font-medium">唯讀基準值</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input
          type="number"
          value={servingAmount}
          readOnly={!isManualMode}
          onChange={(e) => isManualMode && handleServingAmountChange(e.target.value)}
          className={`w-full px-3 py-2 rounded-xl border font-medium transition-colors ${
            !isManualMode
              ? 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed'
              : 'border-slate-200 text-slate-800 focus:outline-sky-600 bg-white'
          }`}
        />
        <div className="relative">
          <div
            onClick={() => isManualMode && setIsUnitDropdownOpen(!isUnitDropdownOpen)}
            className={`w-full px-3 py-2 rounded-xl border font-medium flex items-center justify-between transition-colors ${
              !isManualMode
                ? 'border-slate-200 bg-slate-100 text-slate-600 cursor-not-allowed'
                : 'border-slate-200 text-slate-800 bg-white cursor-pointer shadow-2xs hover:border-sky-500'
            }`}
          >
            <span>{unitOptions.find(o => o.value === servingUnit)?.label || servingUnit}</span>
            {isManualMode && <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
          
          {isUnitDropdownOpen && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setIsUnitDropdownOpen(false)} 
              />
              <div className="absolute z-20 w-full bottom-full mb-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {unitOptions.map((option) => (
                  <div
                    key={option.value}
                    onClick={() => {
                      setServingUnit(option.value);
                      setIsUnitDropdownOpen(false);
                    }}
                    className={`px-3 py-2 cursor-pointer text-sm font-medium transition-colors ${
                      servingUnit === option.value 
                        ? 'bg-sky-50 text-sky-700' 
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {option.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  const renderNutrientsSection = () => (
    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700">每份營養成分含量</span>
        <button
          type="button"
          onClick={handleAutoCalcCalories}
          className="text-xs font-semibold text-sky-700 hover:text-sky-800 flex items-center gap-1 cursor-pointer bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs"
        >
          <Sparkles className="w-3.5 h-3.5" />
          依三大營養素自動換算熱量
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <div>
          <label className="block text-[11px] font-bold text-sky-800 mb-1">熱量 (kcal)</label>
          <input
            type="number"
            step="0.1"
            value={calories ?? ''}
            onChange={(e) => setCalories(e.target.value)}
            className="w-full p-2 text-center rounded-xl border border-sky-300 bg-white font-bold text-slate-800"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-amber-700 mb-1">碳水 (g)</label>
          <input
            type="number"
            step="0.1"
            value={carbs ?? ''}
            onChange={(e) => setCarbs(e.target.value)}
            className="w-full p-2 text-center rounded-xl border border-amber-300 bg-white font-bold text-slate-800"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-blue-700 mb-1">蛋白質 (g)</label>
          <input
            type="number"
            step="0.1"
            value={protein ?? ''}
            onChange={(e) => setProtein(e.target.value)}
            className="w-full p-2 text-center rounded-xl border border-blue-300 bg-white font-bold text-slate-800"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-rose-700 mb-1">脂肪 (g)</label>
          <input
            type="number"
            step="0.1"
            value={fat ?? ''}
            onChange={(e) => setFat(e.target.value)}
            className="w-full p-2 text-center rounded-xl border border-rose-300 bg-white font-bold text-slate-800"
            placeholder="0"
          />
        </div>
      </div>

      <MacroCalorieVerifier
        calories={Number(calories)||0}
        carbs={Number(carbs)||0}
        protein={Number(protein)||0}
        fat={Number(fat)||0}
        onApplyCalculated={(val) => setCalories(val)}
      />

      <div className="grid grid-cols-4 gap-2 text-xs">
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">糖 (g)</label>
          <input
            type="number"
            step="0.1"
            value={sugars ?? ''}
            onChange={(e) => setSugars(e.target.value)}
            className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-center"
          />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">纖維 (g)</label>
          <input
            type="number"
            step="0.1"
            value={fiber ?? ''}
            onChange={(e) => setFiber(e.target.value)}
            className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-center"
          />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">鈉 (mg)</label>
          <input
            type="number"
            step="1"
            value={sodium ?? ''}
            onChange={(e) => setSodium(e.target.value)}
            className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-center"
          />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">鉀 (mg)</label>
          <input
            type="number"
            step="1"
            value={potassium ?? ''}
            onChange={(e) => setPotassium(e.target.value)}
            className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-center"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {mode === 'AI_REVIEW' ? 'AI 辨識結果確認' : mode === 'ADD_RECORD' ? '確認飲食內容' : mode === 'EDIT_RECORD' ? '修改飲食內容' : initialFood ? '編輯自訂飲食' : '新增自訂飲食'}
            </h2>
            <p className="text-xs text-slate-500">
              {mode === 'EDIT_RECORD' ? '修改此筆飲食的營養成分與份量' : mode === 'AI_REVIEW' ? '請確認或微調 AI 辨識出的營養資訊' : mode === 'ADD_RECORD' ? '確認或微調此筆飲食的營養成分與份量' : '輸入自訂食品的每份營養成分'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 overflow-y-auto space-y-4 text-sm">
          {error && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Name & Brand */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                食品名稱 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                placeholder="例如: 媽媽私房茶葉蛋"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-sky-600 font-medium text-slate-800"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                品牌或店家
              </label>
              <input
                type="text"
                placeholder="例如: 自訂 / 自煮 / 7-11"
                value={brand}
                onChange={(e) => handleBrandChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-sky-600 font-medium text-slate-800"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  { key: '7-11', label: '7-11' },
                  { key: '全家', label: '全家' },
                  { key: '萊爾富', label: '萊爾富' },
                  { key: 'OK', label: 'OK' },
                  { key: '自煮', label: '自煮' },
                  { key: '自訂', label: '自訂' },
                ].map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => handleBrandChange(b.key)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-medium border transition cursor-pointer ${
                      brand === b.key || normalizeBrandName(brand) === b.key
                        ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Reordered Layout Sequence */}
          {isManualMode ? (
            <div className="space-y-4">
              {/* 1. 編輯每份數值 */}
              {renderServingAmountSection()}
              {/* 2. 編輯每份營養素 */}
              {renderNutrientsSection()}
              {/* 3. 輸入食用重量 */}
              {renderConsumedAmountSection("manual_amount")}
              {/* 4. 預覽熱量營養素 */}
              {renderPreviewSection("manual_preview")}
            </div>
          ) : (
            <div className="space-y-4">
              {/* 1. 輸入食用重量 */}
              {renderConsumedAmountSection("edit_amount")}
              {/* 2. 預覽熱量營養素 */}
              {renderPreviewSection("edit_preview")}
              {/* 3. 編輯每份數值 */}
              {renderServingAmountSection()}
              {/* 4. 編輯每份營養素 */}
              {renderNutrientsSection()}
            </div>
          )}

          {/* Additional bottom controls */}
          <div className="space-y-3">
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">商品條碼</label>
              <input
                type="text"
                placeholder="4710088..."
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800"
              />
            </div>

            {/* Cloud Upload Switch */}
            {isOfficialTfda ? (
              <div className="mt-4 p-3.5 bg-slate-100 border border-slate-200 rounded-2xl flex items-center gap-3 text-slate-500">
                <div className="p-2 bg-slate-200 text-slate-600 rounded-xl">
                  <CloudUpload className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-700">衛福部官方資料不提供上傳服務</div>
                  <div className="text-[11px] text-slate-500">本項目屬於衛福部基礎食材庫，無法發佈至使用者共享雲端。</div>
                </div>
              </div>
            ) : (
              <div className="mt-4 p-3.5 bg-sky-50/80 border border-sky-100 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-sky-600 text-white rounded-xl shadow-xs">
                    <CloudUpload className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                      <span>同步擴充至公共網路資料庫</span>
                    </div>
                    <div className="text-[11px] text-sky-700 font-medium">背景自動同步不卡頓；超商名稱自動正規化（7-11、全家、萊爾富、OK）</div>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shareToCloud}
                    onChange={(e) => setShareToCloud(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                </label>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSharing}
              className="flex items-center gap-1.5 px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSharing ? '檢查中...' : mode === 'AI_REVIEW' || mode === 'ADD_RECORD' ? '確認並新增至紀錄' : mode === 'EDIT_RECORD' ? '儲存修改' : '儲存自訂飲食'}
            </button>
          </div>
        </form>
      </div>

      {/* Duplicate Pre-Check Resolution Dialog */}
      {duplicateModal && duplicateModal.show && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-700 rounded-2xl shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">雲端資料庫已存在相同品項</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  系統偵測到共享資料庫中已有「<span className="font-bold text-slate-800">{duplicateModal.existingFood.brand} - {duplicateModal.existingFood.name}</span>」。為保持資料庫乾淨，您可以選擇覆蓋更新或直接採用雲端現有數值。
                </p>
              </div>
            </div>

            {/* Comparison Box */}
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="font-bold text-slate-500 mb-1">雲端現有數據</div>
                <div className="font-extrabold text-slate-800">{duplicateModal.existingFood.calories} kcal</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  C: {duplicateModal.existingFood.carbs}g | P: {duplicateModal.existingFood.protein}g | F: {duplicateModal.existingFood.fat}g
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  每份 {duplicateModal.existingFood.servingAmount}{duplicateModal.existingFood.servingUnit}
                </div>
              </div>

              <div className="p-3 bg-sky-50 rounded-2xl border border-sky-200">
                <div className="font-bold text-sky-800 mb-1">您本次輸入數據</div>
                <div className="font-extrabold text-sky-950">{duplicateModal.pendingFood.calories} kcal</div>
                <div className="text-[11px] text-sky-700 mt-1">
                  C: {duplicateModal.pendingFood.carbs}g | P: {duplicateModal.pendingFood.protein}g | F: {duplicateModal.pendingFood.fat}g
                </div>
                <div className="text-[10px] text-sky-600 mt-1">
                  每份 {duplicateModal.pendingFood.servingAmount}{duplicateModal.pendingFood.servingUnit}
                </div>
              </div>
            </div>

            {/* Decision Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const food = duplicateModal.pendingFood;
                  const consumed = duplicateModal.pendingConsumedAmount;
                  setDuplicateModal(null);
                  executeSave(food, consumed, true);
                }}
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                以我輸入的數值覆蓋更新雲端資料庫
              </button>

              <button
                type="button"
                onClick={() => {
                  const ef = duplicateModal.existingFood;
                  const adoptedFood: CustomFood = {
                    ...duplicateModal.pendingFood,
                    name: ef.name,
                    brand: ef.brand,
                    calories: ef.calories,
                    carbs: ef.carbs,
                    protein: ef.protein,
                    fat: ef.fat,
                    sugars: ef.sugars,
                    fiber: ef.fiber,
                    sodium: ef.sodium,
                    potassium: ef.potassium,
                    servingAmount: ef.servingAmount,
                    servingUnit: ef.servingUnit,
                    barcode: ef.barcode || duplicateModal.pendingFood.barcode,
                    isSharedToCloud: false,
                  };
                  const consumed = duplicateModal.pendingConsumedAmount;
                  setDuplicateModal(null);
                  executeSave(adoptedFood, consumed, false);
                }}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
                採用雲端現有數值（不重複上傳）
              </button>

              <button
                type="button"
                onClick={() => setDuplicateModal(null)}
                className="w-full py-2 text-slate-500 hover:text-slate-700 font-semibold text-xs transition cursor-pointer"
              >
                返回修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
