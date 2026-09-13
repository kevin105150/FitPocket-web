import React, { useState } from 'react';
import { X, Save, Sparkles, AlertCircle } from 'lucide-react';
import { CustomFood } from '../types';
import { MacroCalorieVerifier } from './MacroCalorieVerifier';

interface CustomFoodModalProps {
  onClose: () => void;
  onSave: (food: CustomFood) => void;
  initialFood?: CustomFood;
}

export const CustomFoodModal: React.FC<CustomFoodModalProps> = ({
  onClose,
  onSave,
  initialFood,
}) => {
  const [name, setName] = useState(initialFood?.name || '');
  const [brand, setBrand] = useState(initialFood?.brand || '');
  const [calories, setCalories] = useState<number>(initialFood?.caloriesPer100g || 0);
  const [carbs, setCarbs] = useState<number>(initialFood?.carbsPer100g || 0);
  const [protein, setProtein] = useState<number>(initialFood?.proteinPer100g || 0);
  const [fat, setFat] = useState<number>(initialFood?.fatPer100g || 0);
  const [sugars, setSugars] = useState<number>(initialFood?.sugarsPer100g || 0);
  const [fiber, setFiber] = useState<number>(initialFood?.fiberPer100g || 0);
  const [sodium, setSodium] = useState<number>(initialFood?.sodiumPer100g || 0);
  const [potassium, setPotassium] = useState<number>(initialFood?.potassiumPer100g || 0);
  const [defaultServingAmount, setDefaultServingAmount] = useState<number>(
    initialFood?.defaultServingAmount || 100
  );
  const [servingUnit, setServingUnit] = useState<string>(initialFood?.servingUnit || 'g');
  const [barcode, setBarcode] = useState<string>(initialFood?.barcode || '');
  const [servingSizeText, setServingSizeText] = useState<string>(
    initialFood?.servingSizeText || ''
  );
  const [error, setError] = useState<string>('');

  // Auto calculate calories from macros helper
  const handleAutoCalcCalories = () => {
    const calc = Math.round((carbs * 4 + protein * 4 + fat * 9) * 10) / 10;
    setCalories(calc);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('請輸入食品名稱');
      return;
    }

    const food: CustomFood = {
      id: initialFood?.id || 'custom_' + Date.now(),
      name: name.trim(),
      brand: brand.trim() || '自訂飲食',
      caloriesPer100g: Number(calories) || 0,
      carbsPer100g: Number(carbs) || 0,
      proteinPer100g: Number(protein) || 0,
      fatPer100g: Number(fat) || 0,
      sugarsPer100g: Number(sugars) || 0,
      fiberPer100g: Number(fiber) || 0,
      sodiumPer100g: Number(sodium) || 0,
      potassiumPer100g: Number(potassium) || 0,
      defaultServingAmount: Number(defaultServingAmount) || 100,
      servingUnit: servingUnit || 'g',
      servingSizeText: servingSizeText.trim() || `1份 (${defaultServingAmount}${servingUnit})`,
      barcode: barcode.trim() || undefined,
      updatedAt: Date.now(),
    };

    onSave(food);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">
              {initialFood ? '編輯自訂飲食' : '新增自訂飲食'}
            </h2>
            <p className="text-xs text-slate-500">輸入每 100g 的營養成分與常見份量</p>
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

          <div className="grid grid-cols-2 gap-3">
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
                onChange={(e) => setBrand(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-emerald-600 font-medium text-slate-800"
              />
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">每 100g 營養素</span>
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
                  value={calories || ''}
                  onChange={(e) => setCalories(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 text-center rounded-xl border border-emerald-300 bg-white font-bold text-slate-800"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-amber-700 mb-1">碳水 (g)</label>
                <input
                  type="number"
                  step="0.1"
                  value={carbs || ''}
                  onChange={(e) => setCarbs(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 text-center rounded-xl border border-amber-300 bg-white font-bold text-slate-800"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-blue-700 mb-1">蛋白質 (g)</label>
                <input
                  type="number"
                  step="0.1"
                  value={protein || ''}
                  onChange={(e) => setProtein(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 text-center rounded-xl border border-blue-300 bg-white font-bold text-slate-800"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-rose-700 mb-1">脂肪 (g)</label>
                <input
                  type="number"
                  step="0.1"
                  value={fat || ''}
                  onChange={(e) => setFat(parseFloat(e.target.value) || 0)}
                  className="w-full p-2 text-center rounded-xl border border-rose-300 bg-white font-bold text-slate-800"
                  placeholder="0"
                />
              </div>
            </div>

            <MacroCalorieVerifier calories={calories} carbs={carbs} protein={protein} fat={fat} />

            <div className="grid grid-cols-4 gap-2 text-xs">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">糖 (g)</label>
                <input
                  type="number"
                  step="0.1"
                  value={sugars || ''}
                  onChange={(e) => setSugars(parseFloat(e.target.value) || 0)}
                  className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-center"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">纖維 (g)</label>
                <input
                  type="number"
                  step="0.1"
                  value={fiber || ''}
                  onChange={(e) => setFiber(parseFloat(e.target.value) || 0)}
                  className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-center"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">鈉 (mg)</label>
                <input
                  type="number"
                  step="1"
                  value={sodium || ''}
                  onChange={(e) => setSodium(parseFloat(e.target.value) || 0)}
                  className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-center"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">鉀 (mg)</label>
                <input
                  type="number"
                  step="1"
                  value={potassium || ''}
                  onChange={(e) => setPotassium(parseFloat(e.target.value) || 0)}
                  className="w-full p-1.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-center"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">預設單份量</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={defaultServingAmount}
                  onChange={(e) => setDefaultServingAmount(parseFloat(e.target.value) || 0)}
                  className="w-24 px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800"
                />
                <input
                  type="text"
                  value={servingUnit}
                  onChange={(e) => setServingUnit(e.target.value)}
                  className="w-16 px-2 py-2 rounded-xl border border-slate-200 font-medium text-slate-800 text-center"
                  placeholder="g"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">商品條碼 (選填)</label>
              <input
                type="text"
                placeholder="4710088..."
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              規格文字說明 (選填)
            </label>
            <input
              type="text"
              placeholder="例如: 1盒 (約240g, 蛋白質18g)"
              value={servingSizeText}
              onChange={(e) => setServingSizeText(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 font-medium text-slate-800 text-xs"
            />
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
              className="flex items-center gap-1.5 px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              儲存自訂飲食
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
