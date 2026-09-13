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
  const [amount, setAmount] = useState<number>(food.defaultServingAmount || 100);
  const [unit, setUnit] = useState<string>(food.servingUnit || 'g');

  const ratio = (amount || 0) / 100;
  const cal = Math.round(food.caloriesPer100g * ratio * 10) / 10;
  const carbs = Math.round(food.carbsPer100g * ratio * 10) / 10;
  const pro = Math.round(food.proteinPer100g * ratio * 10) / 10;
  const fat = Math.round(food.fatPer100g * ratio * 10) / 10;
  const sugars = Math.round((food.sugarsPer100g || 0) * ratio * 10) / 10;
  const fiber = Math.round((food.fiberPer100g || 0) * ratio * 10) / 10;
  const sodium = Math.round((food.sodiumPer100g || 0) * ratio * 10) / 10;
  const potassium = Math.round((food.potassiumPer100g || 0) * ratio * 10) / 10;

  const handleAdjust = (delta: number) => {
    setAmount((prev) => Math.max(5, Math.round((prev + delta) * 10) / 10));
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
      amount,
      unit,
      barcode: food.barcode,
      imageUrl: food.imageUrl,
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
            <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-0.5">
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
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
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
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {quick}g
                </button>
              ))}
            </div>
          </div>

          {/* Calculated Nutrition Card */}
          <div className="bg-emerald-50/70 border border-emerald-200/60 p-4 rounded-2xl">
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-xs font-bold text-emerald-900">總計熱量</span>
              <span className="text-2xl font-black text-emerald-800">
                {cal} <span className="text-sm font-semibold text-emerald-700">kcal</span>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-emerald-200/50">
              <div className="bg-white/80 p-2 rounded-xl">
                <span className="text-[11px] font-bold text-amber-700 block">碳水</span>
                <span className="text-sm font-black text-slate-800">{carbs}g</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl">
                <span className="text-[11px] font-bold text-blue-700 block">蛋白質</span>
                <span className="text-sm font-black text-slate-800">{pro}g</span>
              </div>
              <div className="bg-white/80 p-2 rounded-xl">
                <span className="text-[11px] font-bold text-rose-700 block">脂肪</span>
                <span className="text-sm font-black text-slate-800">{fat}g</span>
              </div>
            </div>

            {/* Micro nutrients */}
            <div className="grid grid-cols-4 gap-1 text-center mt-2 text-[10px] text-slate-600">
              <div>糖 {sugars}g</div>
              <div>纖維 {fiber}g</div>
              <div>鈉 {sodium}mg</div>
              <div>鉀 {potassium}mg</div>
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
            className="flex-2 py-3 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-bold rounded-2xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            加入飲食日誌
          </button>
        </div>
      </div>
    </div>
  );
};
