import React, { useState } from 'react';
import { X, Save, RotateCcw } from 'lucide-react';
import { CarbCycleType, NutritionGoalPreset } from '../types';
import { CARB_CYCLE_INFO, DEFAULT_PRESETS } from '../data/defaults';
import { MacroCalorieVerifier } from './MacroCalorieVerifier';

interface GoalSettingModalProps {
  currentCycle: CarbCycleType;
  presets: Record<CarbCycleType, NutritionGoalPreset>;
  onClose: () => void;
  onSave: (presets: Record<CarbCycleType, NutritionGoalPreset>) => void;
}

export const GoalSettingModal: React.FC<GoalSettingModalProps> = ({
  currentCycle,
  presets,
  onClose,
  onSave,
}) => {
  const [selectedCycle, setSelectedCycle] = useState<CarbCycleType>(currentCycle);
  const [editingPresets, setEditingPresets] = useState<Record<CarbCycleType, Record<keyof NutritionGoalPreset, number | string>>>(
    JSON.parse(JSON.stringify(presets))
  );

  const activePreset = editingPresets[selectedCycle];

  const updateField = (field: keyof NutritionGoalPreset, val: number | string) => {
    setEditingPresets((prev) => ({
      ...prev,
      [selectedCycle]: {
        ...prev[selectedCycle],
        [field]: val,
      },
    }));
  };

  const handleReset = () => {
    setEditingPresets((prev) => ({
      ...prev,
      [selectedCycle]: { ...DEFAULT_PRESETS[selectedCycle] },
    }));
  };

  const handleSave = () => {
    const finalPresets = {} as Record<CarbCycleType, NutritionGoalPreset>;
    const keys: CarbCycleType[] = ['HIGH', 'MEDIUM', 'LOW', 'CUSTOM'];
    for (const c of keys) {
      const p = editingPresets[c];
      finalPresets[c] = {
        type: c,
        calories: Number(p.calories) || 0,
        carbs: Number(p.carbs) || 0,
        protein: Number(p.protein) || 0,
        fat: Number(p.fat) || 0,
        sodium: Number(p.sodium) || 0,
        potassium: Number(p.potassium) || 0,
      };
    }
    onSave(finalPresets);
    onClose();
  };

  const carbCycles: CarbCycleType[] = ['HIGH', 'MEDIUM', 'LOW', 'CUSTOM'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">每日營養與碳循環目標設定</h2>
            <p className="text-xs text-slate-500">調整各循環日的熱量與營養素分配</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cycle selector pills */}
        <div className="px-6 pt-4 pb-2">
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-2xl">
            {carbCycles.map((c) => {
              const info = CARB_CYCLE_INFO[c];
              const isSelected = selectedCycle === c;
              return (
                <button
                  key={c}
                  onClick={() => setSelectedCycle(c)}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition cursor-pointer flex flex-col items-center gap-0.5 ${
                    isSelected
                      ? 'bg-white text-sky-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="text-sm">{info.emoji}</span>
                  <span>{info.shortName}</span>
                </button>
              );
            })}
          </div>
          <div className="text-xs text-slate-500 mt-2 text-center">
            {CARB_CYCLE_INFO[selectedCycle].description}
          </div>
        </div>

        {/* Scrollable form */}
        <div className="px-6 py-4 overflow-y-auto space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              目標熱量 (kcal)
            </label>
            <input
              type="number"
              value={activePreset.calories}
              onChange={(e) => updateField('calories', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-sky-600 font-semibold text-slate-800"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-amber-700 mb-1">
                碳水化合物 (g)
              </label>
              <input
                type="number"
                value={activePreset.carbs}
                onChange={(e) => updateField('carbs', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-amber-200 focus:outline-amber-600 font-semibold text-slate-800"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                約 {Math.round((Number(activePreset.carbs) || 0) * 4)} kcal
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-blue-700 mb-1">
                蛋白質 (g)
              </label>
              <input
                type="number"
                value={activePreset.protein}
                onChange={(e) => updateField('protein', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-blue-200 focus:outline-blue-600 font-semibold text-slate-800"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                約 {Math.round((Number(activePreset.protein) || 0) * 4)} kcal
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-rose-700 mb-1">
                脂肪 (g)
              </label>
              <input
                type="number"
                value={activePreset.fat}
                onChange={(e) => updateField('fat', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-rose-200 focus:outline-rose-600 font-semibold text-slate-800"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                約 {Math.round((Number(activePreset.fat) || 0) * 9)} kcal
              </span>
            </div>
          </div>

          <MacroCalorieVerifier
            calories={Number(activePreset.calories) || 0}
            carbs={Number(activePreset.carbs) || 0}
            protein={Number(activePreset.protein) || 0}
            fat={Number(activePreset.fat) || 0}
            onApplyCalculated={(val) => updateField('calories', val)}
          />

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                鈉上限 (mg)
              </label>
              <input
                type="number"
                value={activePreset.sodium}
                onChange={(e) => updateField('sodium', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-semibold text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                鉀建議 (mg)
              </label>
              <input
                type="number"
                value={activePreset.potassium}
                onChange={(e) => updateField('potassium', e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-semibold text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-3 py-2 rounded-xl hover:bg-slate-200 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重設此循環預設
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl shadow-xs transition cursor-pointer"
            >
              <Save className="w-4 h-4" />
              儲存目標
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
