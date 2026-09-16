import React, { useState } from 'react';
import { X, Check, Plus, Minus } from 'lucide-react';
import { FoodRecord, FoodSearchResult, MealType } from '../types';

interface PortionModalProps {
  food: FoodSearchResult;
  targetMeal: MealType;
  currentDate: string;
  onClose: () => void;
  onConfirm: (record: FoodRecord) => void;
}

export const PortionModal: React.FC<PortionModalProps> = ({
  food,
  targetMeal,
  currentDate,
  onClose,
  onConfirm,
}) => {
  const [amount, setAmount] = useState<number | string>(food.servingAmount || 100);
  const [unit, setUnit] = useState<string>(food.servingUnit || 'g');

  const numericAmount = typeof amount === 'number' ? amount : (parseFloat(amount) || 0);

  // Multiplier logic
  let multiplier = 1.0;
  if (unit === '份') {
    multiplier = numericAmount;
  } else if (unit === food.servingUnit) {
    multiplier = numericAmount / (food.servingAmount || 1);
  } else {
    if (unit === 'g' || unit === 'ml') {
      multiplier = numericAmount / (food.servingAmount || 100);
    } else {
      multiplier = numericAmount;
    }
  }

  const cal = Math.round(food.calories * multiplier * 10) / 10;
  const carbs = Math.round(food.carbs * multiplier * 10) / 10;
  const pro = Math.round(food.protein * multiplier * 10) / 10;
  const fat = Math.round(food.fat * multiplier * 10) / 10;
  const sugars = Math.round((food.sugars || 0) * multiplier * 10) / 10;
  const fiber = Math.round((food.fiber || 0) * multiplier * 10) / 10;
  const sodium = Math.round((food.sodium || 0) * multiplier * 10) / 10;
  const potassium = Math.round((food.potassium || 0) * multiplier * 10) / 10;

  const handleAdjust = (delta: number) => {
    setAmount((prev) => {
      const current = typeof prev === 'number' ? prev : (parseFloat(prev) || 0);
      return Math.max(5, Math.round((current + delta) * 10) / 10);
    });
  };

  const handleSave = () => {
    const record: FoodRecord = {
      id: 'record_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: food.name,
      mealType: targetMeal,
      date: currentDate,
      calories: cal,
      carbs,
      protein: pro,
      fat,
      sugars,
      fiber,
      sodium,
      potassium,
      loggedAmount: numericAmount,
      loggedUnit: unit,
      brand: food.brand,
      barcode: food.barcode,
      sourceFoodId: food.id.startsWith('custom_') ? food.id.replace('custom_', '') : undefined,
      createdAt: Date.now(),
    };
    onConfirm(record);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div>
            <div className="text-xs font-semibold text-sky-700 uppercase tracking-wider mb-0.5">
              {food.brand || '一般食材'}
            </div>
            <h2 className="text-lg font-bold text-slate-900 leading-snug">{food.name}</h2>
            {food.servingSizeText && (
              <p className="text-xs text-slate-500 mt-0.5">參考規格：{food.servingSizeText}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Portion Stepper */}
        <div className="p-5 space-y-5">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <label className="block text-xs font-bold text-slate-600 mb-2">記錄份量 / 重量</label>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleAdjust(-10)}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 active:scale-95 transition cursor-pointer shadow-2xs font-bold text-lg"
              >
                <Minus className="w-4 h-4" />
              </button>

              <div className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-slate-200 rounded-xl py-1.5 px-3 shadow-2xs">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-24 text-center text-xl font-black text-slate-900 focus:outline-none"
                  min="1"
                />
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="bg-slate-100 text-xs font-bold text-slate-700 py-1 px-2 rounded-lg cursor-pointer focus:outline-none"
                >
                  <option value="g">公克 (g)</option>
                  <option value="份">份</option>
                  <option value="顆">顆</option>
                  <option value="碗">碗</option>
                  <option value="ml">毫升 (ml)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => handleAdjust(10)}
                className="w-11 h-11 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 active:scale-95 transition cursor-pointer shadow-2xs font-bold text-lg"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Quick adjust chips */}
            <div className="flex items-center justify-center gap-2 mt-3">
              {[50, 100, 150, 200, 250].map((quick) => (
                <button
                  key={quick}
                  onClick={() => setAmount(quick)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                    amount === quick
                      ? 'bg-sky-600 text-white font-bold'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {quick}g
                </button>
              ))}
            </div>
          </div>

          {/* Calculated Nutrition Card */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-xs font-bold text-slate-600">實際攝取營養預覽：</span>
              <span className="text-2xl font-black text-sky-800">
                {cal} <span className="text-sm font-semibold text-sky-700">kcal</span>
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                <div className="text-[10px] text-amber-600 mb-0.5 font-bold">碳水</div>
                <div className="text-sm font-black text-slate-800">{carbs}g</div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                <div className="text-[10px] text-blue-600 mb-0.5 font-bold">蛋白質</div>
                <div className="text-sm font-black text-slate-800">{pro}g</div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                <div className="text-[10px] text-rose-600 mb-0.5 font-bold">脂肪</div>
                <div className="text-sm font-black text-slate-800">{fat}g</div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                <div className="text-[10px] text-orange-500 mb-0.5 font-bold">糖</div>
                <div className="text-sm font-black text-slate-800">{sugars}g</div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                <div className="text-[10px] text-slate-400 mb-0.5 font-bold">纖維</div>
                <div className="text-sm font-black text-slate-800">{fiber}g</div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                <div className="text-[10px] text-indigo-500 mb-0.5 font-bold">鈉</div>
                <div className="text-[10px] font-black text-slate-800">{sodium}mg</div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs">
                <div className="text-[10px] text-cyan-500 mb-0.5 font-bold">鉀</div>
                <div className="text-[10px] font-black text-slate-800">{potassium}mg</div>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-2xs flex flex-col justify-center">
                <div className="text-[9px] text-slate-400 leading-tight">即時<br/>換算</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-2xl transition cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-2 py-3 bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold rounded-2xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            加入飲食日誌
          </button>
        </div>
      </div>
    </div>
  );
};
