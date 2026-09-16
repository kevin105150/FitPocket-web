import React, { useState, useRef } from 'react';
import { X, Save, Sparkles, AlertCircle, ChevronDown, CloudUpload, AlertTriangle, CheckCircle2 } from 'lucide-react';
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

export const CustomFoodModal: React.FC<CustomFoodModalProps> = ({
  onClose,
  onSave,
  initialFood,
  initialConsumedAmount,
  mode = "CUSTOM",
}) => {
  const [name, setName] = useState(initialFood?.name || '');
  const [brand, setBrand] = useState(initialFood?.brand || '');
  const [calories, setCalories] = useState<number | string>(initialFood?.calories ?? '');
  const [carbs, setCarbs] = useState<number | string>(initialFood?.carbs ?? '');
  const [protein, setProtein] = useState<number | string>(initialFood?.protein ?? '');
  const [fat, setFat] = useState<number | string>(initialFood?.fat ?? '');
  const [sugars, setSugars] = useState<number | string>(initialFood?.sugars ?? '');
  const [fiber, setFiber] = useState<number | string>(initialFood?.fiber ?? '');
  const [sodium, setSodium] = useState<number | string>(initialFood?.sodium ?? '');
  const [potassium, setPotassium] = useState<number | string>(initialFood?.potassium ?? '');
  
  const [servingAmount, setServingAmount] = useState<number | string>(initialFood?.servingAmount || 100);
  const [consumedAmount, setConsumedAmount] = useState<number | string>(initialConsumedAmount ?? initialFood?.servingAmount ?? 100);
  const [servingUnit, setServingUnit] = useState<string>(initialFood?.servingUnit || 'g');
  const [barcode, setBarcode] = useState<string>(initialFood?.barcode || '');
  
  const isOfficialTfda = isTfdaFood({ id: initialFood?.id, brand });
  const [shareToCloud, setShareToCloud] = useState<boolean>(() => {
    const initFoodObj = initialFood || { brand: brand || '' };
    if (isTfdaFood(initFoodObj)) {
      return false;
    }
    return initialFood?.isSharedToCloud !== undefined ? initialFood.isSharedToCloud : true;
  });
  const [isSharing, setIsSharing] = useState<boolean>(false);

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
    const normalizedBrand = normalizeBrandName(brand.trim() || '自訂飲食');

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
          // Show duplicate resolution dialog
          setDuplicateModal({
            show: true,
            existingFood: preCheck.existingFood,
            pendingFood: food,
            pendingConsumedAmount: parsedConsumed,
          });
          return;
        }
      } catch (checkErr) {
        console.warn('Pre-check failed, continuing:', checkErr);
      } finally {
        setIsSharing(false);
      }
    }

    await executeSave(food, parsedConsumed, !!food.isSharedToCloud);
  };

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
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-emerald-600 font-medium text-slate-800"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                品牌或店家
              </label>
              <input
                type="text"
                placeholder="例如: 自煮 / 巷口便當"
                value={brand}
                onChange={(e) => handleBrandChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-emerald-600 font-medium text-slate-800"
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  { key: '7-11', label: '7-11' },
                  { key: '全家', label: '全家' },
                  { key: '萊爾富', label: '萊爾富' },
                  { key: 'OK', label: 'OK' },
                  { key: '自煮', label: '自煮' },
                  { key: '好市多 (Costco)', label: '好市多' },
                  { key: '麥當勞', label: '麥當勞' },
                ].map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => handleBrandChange(b.key)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg font-medium border transition cursor-pointer ${
                      brand === b.key || normalizeBrandName(brand) === b.key
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">每份營養成分含量</span>
              <button
                type="button"
                onClick={handleAutoCalcCalories}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                依三大營養素自動換算熱量
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-emerald-800 mb-1">熱量 (kcal)</label>
                <input
                  type="number"
                  step="0.1"
                  value={calories ?? ''}
                  onChange={(e) => setCalories(e.target.value)}
                  className="w-full p-2 text-center rounded-xl border border-emerald-300 bg-white font-bold text-slate-800"
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

          <div className="space-y-3">
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-1">每份份量 (基準份量)</label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  value={servingAmount}
                  onChange={(e) => setServingAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800"
                />
                <div className="relative">
                  <div
                    onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800 bg-white cursor-pointer flex items-center justify-between shadow-sm hover:border-emerald-500 transition-colors"
                  >
                    <span>{unitOptions.find(o => o.value === servingUnit)?.label || servingUnit}</span>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
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
                                ? 'bg-emerald-50 text-emerald-700' 
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
            
            <div className="pt-2">
              <label className="block text-xs font-semibold text-emerald-700 mb-1">
                實際食用份量 (將以此數值加入紀錄) <span className="text-emerald-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  value={consumedAmount}
                  onChange={(e) => setConsumedAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-emerald-200 font-bold text-emerald-800 bg-emerald-50 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
                <div className="flex items-center px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 font-medium">
                  {unitOptions.find(o => o.value === servingUnit)?.label || servingUnit}
                </div>
              </div>
              
              {/* 即時預覽攝取營養 */}
              <div className="mt-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
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
            </div>

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
                      <span className="text-[10px] bg-sky-200/80 text-sky-900 font-extrabold px-1.5 py-0.25 rounded-md">背景執行</span>
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
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
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

              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                <div className="font-bold text-emerald-800 mb-1">您本次輸入數據</div>
                <div className="font-extrabold text-emerald-950">{duplicateModal.pendingFood.calories} kcal</div>
                <div className="text-[11px] text-emerald-700 mt-1">
                  C: {duplicateModal.pendingFood.carbs}g | P: {duplicateModal.pendingFood.protein}g | F: {duplicateModal.pendingFood.fat}g
                </div>
                <div className="text-[10px] text-emerald-600 mt-1">
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
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                以我輸入的數值覆蓋更新雲端資料庫（背景執行）
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
