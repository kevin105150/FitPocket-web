import React, { useState, useEffect } from 'react';
import { Droplets, Plus, Trash2, Sliders, CheckCircle2, RotateCcw } from 'lucide-react';
import { WaterRecord } from '../types';
import { StorageService } from '../services/storage';
import { DateNavigator } from './DateNavigator';
import { motion } from 'motion/react';

interface WaterTrackerProps {
  currentDate: string;
  onDateChange: (date: string) => void;
}

export const WaterTracker: React.FC<WaterTrackerProps> = ({
  currentDate,
  onDateChange,
}) => {
  const [waterRecords, setWaterRecords] = useState<WaterRecord[]>([]);
  const [waterGoal, setWaterGoal] = useState<number>(2500);
  const [customMl, setCustomMl] = useState<number | string>(300);
  const [showGoalModal, setShowGoalModal] = useState<boolean>(false);
  const [tempGoal, setTempGoal] = useState<number | string>(2500);
  const [quickPresets, setQuickPresets] = useState<number[]>([100, 250, 350, 500, 750, 1000]);
  const [tempPresets, setTempPresets] = useState<number[]>([100, 250, 350, 500, 750, 1000]);

  // Safe delete state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const refreshWater = () => {
    setWaterRecords(StorageService.getWaterRecordsByDate(currentDate));
    const goal = StorageService.getWaterGoal();
    setWaterGoal(goal);
    setTempGoal(goal);
    const presets = StorageService.getWaterPresets();
    setQuickPresets(presets);
    setTempPresets(presets);
  };

  useEffect(() => {
    refreshWater();
  }, [currentDate]);

  const totalWater = waterRecords.reduce((sum, r) => sum + r.amountMl, 0);
  const percent = Math.min(100, Math.round((totalWater / (waterGoal || 1)) * 100));
  const remaining = Math.max(0, waterGoal - totalWater);

  const handleAddWater = (amount: number) => {
    if (amount <= 0) return;
    const rec: WaterRecord = {
      id: 'water_' + Date.now(),
      date: currentDate,
      amountMl: amount,
      timestamp: Date.now(),
    };
    StorageService.saveWaterRecord(rec);
    refreshWater();
  };

  const handleDeleteRecord = (id: string) => {
    StorageService.deleteWaterRecord(id);
    refreshWater();
  };

  const handleSaveGoal = () => {
    const numericGoal = typeof tempGoal === 'number' ? tempGoal : (parseInt(tempGoal) || 0);
    if (numericGoal > 0) {
      StorageService.setWaterGoal(numericGoal);
      StorageService.setWaterPresets(tempPresets);
      setWaterGoal(numericGoal);
      setQuickPresets(tempPresets);
      setShowGoalModal(false);
    }
  };

  return (
    <div className="space-y-4 pb-24 max-w-2xl mx-auto">
      {/* Date Navigator */}
      <DateNavigator currentDate={currentDate} onDateChange={onDateChange} />

      {/* Main Water Card */}
      <div className="bg-white rounded-3xl border border-sky-100 shadow-sm p-6 flex flex-col items-center relative overflow-hidden">
        <button
          type="button"
          onClick={() => setShowGoalModal(true)}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition cursor-pointer"
          title="設定每日飲水目標"
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* Circular Water Indicator */}
        <div className="relative w-52 h-52 my-3 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="52"
              className="text-sky-50 stroke-current"
              strokeWidth="10"
              fill="transparent"
            />
            <circle
              cx="60"
              cy="60"
              r="52"
              className="text-sky-500 stroke-current transition-all duration-500"
              strokeWidth="10"
              strokeDasharray="326"
              strokeDashoffset={326 - (326 * percent) / 100}
              strokeLinecap="round"
              fill="transparent"
            />
          </svg>

          <div className="absolute flex flex-col items-center">
            <Droplets className="w-8 h-8 text-sky-500 mb-1" />
            <div className="text-3xl font-black text-slate-900 tracking-tight">
              {totalWater}
              <span className="text-sm font-semibold text-slate-400 ml-1">ml</span>
            </div>
            <div className="text-xs font-semibold text-slate-400 mt-0.5">
              目標 {waterGoal} ml ({percent}%)
            </div>
          </div>
        </div>

        {/* Status text */}
        <div className="text-center mt-1">
          {remaining === 0 ? (
            <div className="flex items-center gap-1 text-sky-700 font-bold text-sm bg-sky-50 px-3 py-1 rounded-full">
              <CheckCircle2 className="w-4 h-4" />
              <span>今日飲水目標已達成！</span>
            </div>
          ) : (
            <span className="text-xs font-semibold text-slate-500">
              距離每日目標還差 <strong className="text-sky-700">{remaining} ml</strong>
            </span>
          )}
        </div>

        {/* Quick Add Presets */}
        <div className="w-full pt-6">
          <div className="text-xs font-bold text-slate-400 mb-2.5 uppercase tracking-wider text-center">
            快速記錄補水
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {quickPresets.map((ml) => (
              <button
                key={ml}
                type="button"
                onClick={() => handleAddWater(ml)}
                className="py-2.5 px-2 bg-sky-50 hover:bg-sky-100 active:scale-95 border border-sky-200/60 rounded-2xl text-xs font-black text-sky-800 transition cursor-pointer flex flex-col items-center gap-0.5"
              >
                <span>+{ml}</span>
                <span className="text-[10px] text-sky-600 font-medium">ml</span>
              </button>
            ))}
          </div>

          {/* Custom ml input */}
          <div className="mt-4 flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
            <input
              type="number"
              value={customMl}
              onChange={(e) => setCustomMl(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-white rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-sky-600"
              placeholder="自訂毫升數"
              min="10"
              step="50"
            />
            <span className="text-xs font-semibold text-slate-500">ml</span>
            <button
              type="button"
              onClick={() => handleAddWater(typeof customMl === 'number' ? customMl : (parseInt(customMl) || 0))}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
            >
              記錄
            </button>
          </div>
        </div>
      </div>

      {/* Water Records List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-800 text-sm">今日飲水明細</h3>
          <span className="text-xs text-slate-400">共 {waterRecords.length} 筆</span>
        </div>

        {waterRecords.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {waterRecords.map((r) => {
              const timeStr = new Date(r.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div key={r.id} className="relative overflow-hidden py-1">
                  {/* Beneath Action Row */}
                  <div className="absolute inset-y-1.5 right-1 flex items-stretch gap-1 z-0">
                    <button
                      type="button"
                      onClick={() => {
                        handleDeleteRecord(r.id);
                        setConfirmDeleteId(null);
                      }}
                      className="px-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl flex items-center justify-center transition cursor-pointer"
                    >
                      確定
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl flex items-center justify-center transition cursor-pointer"
                    >
                      取消
                    </button>
                  </div>

                  {/* Sliding Card Content */}
                  <motion.div
                    animate={{ x: confirmDeleteId === r.id ? -125 : 0 }}
                    transition={{ type: 'spring', damping: 24, stiffness: 220 }}
                    className="relative z-10 bg-white py-2 flex items-center justify-between gap-3 w-full"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
                        <Droplets className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-black text-sm text-slate-800">+{r.amountMl} ml</div>
                        <div className="text-[11px] text-slate-400">{timeStr}</div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(r.id)}
                      className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400">今日尚無飲水紀錄，多喝水保持健康代謝！</div>
        )}
      </div>

      {/* Goal Setting Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-xl p-6 animate-in zoom-in-95 duration-200">
            <h3 className="font-bold text-slate-800 text-base mb-1">飲水設定</h3>
            <p className="text-xs text-slate-500 mb-4">設定每日目標攝取量與下方快速點擊按鈕數值</p>

            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                每日飲水目標
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={tempGoal}
                  onChange={(e) => setTempGoal(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-center text-lg font-black text-slate-900 focus:outline-sky-600"
                  step="100"
                />
                <span className="text-sm font-bold text-slate-600 shrink-0">ml</span>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-700 mb-2">
                6 個快速紀錄按鈕數值
              </label>
              <div className="grid grid-cols-3 gap-2">
                {tempPresets.map((presetVal, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">#{idx + 1}</span>
                    <input
                      type="number"
                      value={presetVal || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        const updated = [...tempPresets];
                        updated[idx] = val;
                        setTempPresets(updated);
                      }}
                      className="w-full text-center text-xs font-bold text-slate-800 bg-white rounded-lg py-1 border border-slate-200 focus:outline-sky-600"
                      placeholder="ml"
                      min="10"
                      step="50"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowGoalModal(false)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveGoal}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-bold rounded-xl shadow-xs transition cursor-pointer"
              >
                儲存設定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
