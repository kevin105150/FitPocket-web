import React, { useState, useEffect } from 'react';
import { Droplets, Plus, Trash2, Sliders, CheckCircle2, RotateCcw } from 'lucide-react';
import { WaterRecord } from '../types';
import { StorageService } from '../services/storage';
import { DateNavigator } from './DateNavigator';

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
  const [customMl, setCustomMl] = useState<number>(300);
  const [showGoalModal, setShowGoalModal] = useState<boolean>(false);
  const [tempGoal, setTempGoal] = useState<number>(2500);

  const refreshWater = () => {
    setWaterRecords(StorageService.getWaterRecordsByDate(currentDate));
    const goal = StorageService.getWaterGoal();
    setWaterGoal(goal);
    setTempGoal(goal);
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
    if (tempGoal > 0) {
      StorageService.setWaterGoal(tempGoal);
      setWaterGoal(tempGoal);
      setShowGoalModal(false);
    }
  };

  const quickPresets = [100, 250, 350, 500, 750, 1000];

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
            <div className="flex items-center gap-1 text-emerald-700 font-bold text-sm bg-emerald-50 px-3 py-1 rounded-full">
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
              onChange={(e) => setCustomMl(parseInt(e.target.value) || 0)}
              className="flex-1 px-3 py-1.5 bg-white rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-sky-600"
              placeholder="自訂毫升數"
              min="10"
              step="50"
            />
            <span className="text-xs font-semibold text-slate-500">ml</span>
            <button
              type="button"
              onClick={() => handleAddWater(customMl)}
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
                <div key={r.id} className="py-2.5 flex items-center justify-between">
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
                    onClick={() => handleDeleteRecord(r.id)}
                    className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-xl p-6">
            <h3 className="font-bold text-slate-800 text-base mb-1">設定每日飲水目標</h3>
            <p className="text-xs text-slate-500 mb-4">建議每日攝取量約為體重 × 30~40 ml</p>

            <div className="flex items-center gap-2 mb-6">
              <input
                type="number"
                value={tempGoal}
                onChange={(e) => setTempGoal(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-center text-xl font-black text-slate-900 focus:outline-sky-600"
                step="100"
              />
              <span className="text-sm font-bold text-slate-600">ml</span>
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
                儲存目標
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
