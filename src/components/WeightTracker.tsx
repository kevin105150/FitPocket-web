import React, { useState, useEffect } from 'react';
import { Scale, TrendingDown, TrendingUp, Minus, Calendar, Plus, Trash2, Edit2, Check } from 'lucide-react';
import { WeightRecord } from '../types';
import { StorageService } from '../services/storage';
import { DateNavigator } from './DateNavigator';
import { motion } from 'motion/react';

interface WeightTrackerProps {
  currentDate: string;
  onDateChange: (date: string) => void;
}

export const WeightTracker: React.FC<WeightTrackerProps> = ({
  currentDate,
  onDateChange,
}) => {
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [currentDayRecord, setCurrentDayRecord] = useState<WeightRecord | undefined>(undefined);
  const [morningWeight, setMorningWeight] = useState<string>('');
  const [morningTime, setMorningTime] = useState<string>(new Date().toTimeString().slice(0, 5));
  const [eveningWeight, setEveningWeight] = useState<string>('');
  const [eveningTime, setEveningTime] = useState<string>(new Date().toTimeString().slice(0, 5));
  const [chartDays, setChartDays] = useState<number>(7);
  const [userProfile, setUserProfile] = useState(StorageService.getUserProfile());

  const [activeTab, setActiveTab] = useState<'morning' | 'evening'>(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'morning' : 'evening';
  });
  const [weightRecordToDelete, setWeightRecordToDelete] = useState<WeightRecord | null>(null);
  const [confirmSwipeDeleteId, setConfirmSwipeDeleteId] = useState<string | null>(null);

  const refreshWeights = () => {
    const all = StorageService.getAllWeightRecords().sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    setWeightRecords(all);
    const day = all.find((r) => r.date === currentDate);
    setCurrentDayRecord(day);
    if (day) {
      setMorningWeight(day.morningWeightKg ? day.morningWeightKg.toString() : '');
      setMorningTime(day.morningTime || '08:00');
      setEveningWeight(day.eveningWeightKg ? day.eveningWeightKg.toString() : '');
      setEveningTime(day.eveningTime || '21:30');
    } else {
      setMorningWeight('');
      setMorningTime(new Date().toTimeString().slice(0, 5));
      setEveningWeight('');
      setEveningTime(new Date().toTimeString().slice(0, 5));
    }
    setUserProfile(StorageService.getUserProfile());
  };

  useEffect(() => {
    refreshWeights();
  }, [currentDate]);

  const handleSaveDayWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const mw = morningWeight ? parseFloat(morningWeight) : null;
    const ew = eveningWeight ? parseFloat(eveningWeight) : null;

    if (mw === null && ew === null) {
      // Don't save empty
      return;
    }

    const record: WeightRecord = {
      id: currentDayRecord?.id || 'weight_' + Date.now(),
      date: currentDate,
      morningWeightKg: mw,
      morningTime: mw ? morningTime : null,
      eveningWeightKg: ew,
      eveningTime: ew ? eveningTime : null,
      createdAt: Date.now(),
    };

    StorageService.saveWeightRecord(record);
    refreshWeights();
  };

  // ... (Chart logic needs to be updated to be tab-aware)
  
  const handleDeleteRecord = (id: string) => {
    StorageService.deleteWeightRecord(id);
    setWeightRecordToDelete(null);
    refreshWeights();
  };

  const handleDeleteSpecificWeight = (rec: WeightRecord, type: 'morning' | 'evening') => {
    const updated = { ...rec };
    if (type === 'morning') {
      updated.morningWeightKg = null;
      updated.morningTime = null;
    } else {
      updated.eveningWeightKg = null;
      updated.eveningTime = null;
    }

    if (updated.morningWeightKg === null && updated.eveningWeightKg === null) {
      StorageService.deleteWeightRecord(rec.id);
    } else {
      StorageService.saveWeightRecord(updated);
    }
    setWeightRecordToDelete(null);
    refreshWeights();
  };

  // Compute latest weight and BMI
  const latestRecord = [...weightRecords].reverse().find(
    (r) => r.morningWeightKg || r.eveningWeightKg
  );
  const latestWeight =
    latestRecord?.morningWeightKg || latestRecord?.eveningWeightKg || userProfile.currentWeightKg;
  const heightM = (userProfile.heightCm || 175) / 100;
  const bmi = latestWeight ? parseFloat(((latestWeight / (heightM * heightM))).toFixed(1)) : '--';

  // Chart data filter
  const sortedRecords = [...weightRecords].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const chartFiltered =
    chartDays === 0 ? sortedRecords : sortedRecords.slice(-chartDays);

  // Filter for chart based on tab
  const getChartPoints = (type: 'morning' | 'evening') => {
    return sortedRecords
      .map((r) => {
        const val = type === 'morning' ? r.morningWeightKg : r.eveningWeightKg;
        return val ? { date: r.date.slice(5), weight: val } : null;
      })
      .filter(Boolean) as { date: string; weight: number }[];
  }

  const validChartPoints = getChartPoints(activeTab);

  const minW = Math.min(...validChartPoints.map((p) => p.weight), userProfile.targetWeightKg) - 1;
  const maxW = Math.max(...validChartPoints.map((p) => p.weight), userProfile.targetWeightKg) + 1;
  const rangeW = maxW - minW || 1;

  return (
    <div className="space-y-4 pb-24 max-w-2xl mx-auto">
      {/* Date Navigator */}
      <DateNavigator currentDate={currentDate} onDateChange={onDateChange} />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs text-center">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            晨間體重
          </div>
          <div className="text-xl font-black text-amber-800 mt-1">
            {(() => {
              const last = [...weightRecords].reverse().find(r => r.morningWeightKg);
              return last ? parseFloat(Number(last.morningWeightKg).toFixed(1)) : '--';
            })()}{' '}
            <span className="text-xs font-semibold text-slate-400">kg</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs text-center">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            晚間體重
          </div>
          <div className="text-xl font-black text-indigo-800 mt-1">
            {(() => {
              const last = [...weightRecords].reverse().find(r => r.eveningWeightKg);
              return last ? parseFloat(Number(last.eveningWeightKg).toFixed(1)) : '--';
            })()}{' '}
            <span className="text-xs font-semibold text-slate-400">kg</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs text-center">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            目標體重
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">
            {parseFloat(Number(userProfile.targetWeightKg).toFixed(1))}{' '}
            <span className="text-xs font-semibold text-slate-400">kg</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs text-center">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            身高
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">
            {parseFloat(Number(userProfile.heightCm).toFixed(1))}{' '}
            <span className="text-xs font-semibold text-slate-400">cm</span>
          </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="bg-white p-1 rounded-2xl border border-slate-200 flex gap-1">
        <button
          onClick={() => setActiveTab('morning')}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition ${activeTab === 'morning' ? 'bg-amber-100 text-amber-900' : 'text-slate-500'}`}
        >
          晨間體重
        </button>
        <button
          onClick={() => setActiveTab('evening')}
          className={`flex-1 py-3 text-sm font-bold rounded-xl transition ${activeTab === 'evening' ? 'bg-indigo-100 text-indigo-900' : 'text-slate-500'}`}
        >
          晚間體重
        </button>
      </div>

      {/* Weight Entry Form */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5">
        <h3 className="font-bold text-slate-900 text-sm mb-3">記錄 {currentDate} {activeTab === 'morning' ? '晨間' : '晚間'} 體重</h3>
        <form onSubmit={handleSaveDayWeight} className="space-y-4">
            <div className={`p-4 rounded-2xl border ${activeTab === 'morning' ? 'bg-amber-50/50 border-amber-200/60' : 'bg-indigo-50/50 border-indigo-200/60'}`}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-bold text-slate-700">{activeTab === 'morning' ? '🌅 晨重 (空腹)' : '🌙 晚重 (睡前)'}</span>
                <input
                  type="time"
                  value={activeTab === 'morning' ? morningTime : eveningTime}
                  onChange={(e) => activeTab === 'morning' ? setMorningTime(e.target.value) : setEveningTime(e.target.value)}
                  className="px-2 py-1 text-xs font-bold bg-white rounded-lg border border-slate-200 text-slate-600"
                />
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                <input
                  type="number"
                  step="0.1"
                  placeholder="例如: 72.4"
                  value={activeTab === 'morning' ? morningWeight : eveningWeight}
                  onChange={(e) => activeTab === 'morning' ? setMorningWeight(e.target.value) : setEveningWeight(e.target.value)}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-lg font-black text-slate-800 focus:outline-sky-600"
                />
                <span className="text-sm font-bold text-slate-500">kg</span>
              </div>
            </div>
          <button
            type="submit"
            className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>儲存 {activeTab === 'morning' ? '晨間' : '晚間'} 體重</span>
          </button>
        </form>
      </div>

      {/* Weight Trend Chart */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-900 text-sm">體重趨勢圖表</h3>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { label: '7天', val: 7 },
              { label: '30天', val: 30 },
              { label: '90天', val: 90 },
              { label: '全部', val: 0 },
            ].map((tab) => (
              <button
                key={tab.val}
                type="button"
                onClick={() => setChartDays(tab.val)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  chartDays === tab.val
                    ? 'bg-white text-sky-800 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {validChartPoints.length > 1 ? (
          <div className="w-full h-48 relative pt-4">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 300 120">
              {/* Target Line */}
              {userProfile.targetWeightKg && (
                <line
                  x1="0"
                  y1={120 - ((userProfile.targetWeightKg - minW) / rangeW) * 100}
                  x2="300"
                  y2={120 - ((userProfile.targetWeightKg - minW) / rangeW) * 100}
                  stroke="#38bdf8"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                />
              )}

              {/* Trend Polyline */}
              <polyline
                fill="none"
                stroke="#0284c7"
                strokeWidth="2.5"
                points={validChartPoints
                  .map((p, i) => {
                    const x = (i / (validChartPoints.length - 1)) * 300;
                    const y = 120 - ((p.weight - minW) / rangeW) * 100;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />

              {/* Data points */}
              {validChartPoints.map((p, i) => {
                const x = (i / (validChartPoints.length - 1)) * 300;
                const y = 120 - ((p.weight - minW) / rangeW) * 100;
                return (
                  <g key={i}>
                    <circle cx={x} cy={y} r="3.5" fill="#0284c7" />
                    <text
                      x={x}
                      y={y - 8}
                      fontSize="9"
                      fontWeight="bold"
                      fill="#334155"
                      textAnchor="middle"
                    >
                      {p.weight}
                    </text>
                    <text
                      x={x}
                      y={120}
                      fontSize="8"
                      fill="#94a3b8"
                      textAnchor="middle"
                    >
                      {p.date}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          <div className="py-10 text-center text-xs text-slate-400">
            請至少記錄 2 筆以上的體重資料以繪製連續變化曲線
          </div>
        )}
      </div>

      {/* Weight History List */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5">
        <h3 className="font-bold text-slate-900 text-sm mb-3">近期體重記錄</h3>
        <div className="divide-y divide-slate-100">
          {[...weightRecords].reverse().slice(0, 10).map((rec) => (
            <div key={rec.id} className="relative overflow-hidden py-1">
              {/* Beneath Action Row */}
              <div className="absolute inset-y-1.5 right-1 flex items-stretch gap-1 z-0">
                {rec.morningWeightKg && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSpecificWeight(rec, 'morning')}
                    className="px-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-[10px] rounded-xl flex flex-col items-center justify-center transition cursor-pointer"
                  >
                    <span>刪除</span>
                    <span>晨重</span>
                  </button>
                )}
                {rec.eveningWeightKg && (
                  <button
                    type="button"
                    onClick={() => handleDeleteSpecificWeight(rec, 'evening')}
                    className="px-2.5 bg-indigo-500 hover:bg-indigo-600 text-white font-black text-[10px] rounded-xl flex flex-col items-center justify-center transition cursor-pointer"
                  >
                    <span>刪除</span>
                    <span>晚重</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteRecord(rec.id);
                    setConfirmSwipeDeleteId(null);
                  }}
                  className="px-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] rounded-xl flex flex-col items-center justify-center transition cursor-pointer"
                >
                  <span>刪除</span>
                  <span>全天</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmSwipeDeleteId(null)}
                  className="px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl flex items-center justify-center transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Sliding Card Content */}
              {(() => {
                let slideDist = 85; // 全天(50) + 關閉(35)
                if (rec.morningWeightKg) slideDist += 45;
                if (rec.eveningWeightKg) slideDist += 45;
                
                return (
                  <motion.div
                    animate={{ x: confirmSwipeDeleteId === rec.id ? -slideDist : 0 }}
                    transition={{ type: 'spring', stiffness: 580, damping: 28, mass: 0.4 }}
                    className="relative z-10 bg-white py-2 flex items-center justify-between gap-3 w-full will-change-transform transform-gpu"
                  >
                    <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-slate-800">{rec.date}</div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-500 mt-1.5">
                    {/* Morning Weight Segment */}
                    <div className="flex items-center justify-between w-[115px] bg-amber-50/50 border border-amber-100/50 px-2 py-1 rounded-xl">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] text-amber-900 font-semibold shrink-0">晨重</span>
                        {rec.morningWeightKg != null ? (
                          <span className="text-amber-800 font-black text-[11px] truncate">{parseFloat(Number(rec.morningWeightKg).toFixed(1))}</span>
                        ) : (
                          <span className="text-slate-300 font-medium">--</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onDateChange(rec.date);
                          setActiveTab('morning');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-100 rounded-lg transition cursor-pointer shrink-0"
                        title={rec.morningWeightKg ? "編輯晨間體重" : "新增晨間體重"}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Evening Weight Segment */}
                    <div className="flex items-center justify-between w-[115px] bg-indigo-50/50 border border-indigo-100/50 px-2 py-1 rounded-xl">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-[10px] text-indigo-900 font-semibold shrink-0">晚重</span>
                        {rec.eveningWeightKg != null ? (
                          <span className="text-indigo-800 font-black text-[11px] truncate">{parseFloat(Number(rec.eveningWeightKg).toFixed(1))}</span>
                        ) : (
                          <span className="text-slate-300 font-medium">--</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onDateChange(rec.date);
                          setActiveTab('evening');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-1 text-slate-400 hover:text-indigo-700 hover:bg-indigo-100 rounded-lg transition cursor-pointer shrink-0"
                        title={rec.eveningWeightKg ? "編輯晚間體重" : "新增晚間體重"}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setConfirmSwipeDeleteId(rec.id)}
                  className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
              );
              })()}
            </div>
          ))}
        </div>
      </div>

      {/* Centered weight delete confirmation modal */}
      {weightRecordToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setWeightRecordToDelete(null)} />
          <div className="bg-white rounded-[32px] max-w-sm w-full p-6 shadow-2xl border border-slate-100 relative z-10 flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600">
              <Trash2 className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-black text-slate-900">確認刪除體重紀錄？</h3>
              <p className="text-xs text-slate-500 font-medium">
                日期：<strong className="text-slate-800 font-bold">{weightRecordToDelete.date}</strong>
              </p>
            </div>

            <div className="w-full flex flex-col gap-2 pt-2">
              {weightRecordToDelete.morningWeightKg && (
                <button
                  type="button"
                  onClick={() => handleDeleteSpecificWeight(weightRecordToDelete, 'morning')}
                  className="w-full py-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 font-bold text-xs rounded-2xl transition cursor-pointer"
                >
                  僅刪除 晨間體重 ({parseFloat(Number(weightRecordToDelete.morningWeightKg).toFixed(1))} kg)
                </button>
              )}
              {weightRecordToDelete.eveningWeightKg && (
                <button
                  type="button"
                  onClick={() => handleDeleteSpecificWeight(weightRecordToDelete, 'evening')}
                  className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-950 font-bold text-xs rounded-2xl transition cursor-pointer"
                >
                  僅刪除 晚間體重 ({parseFloat(Number(weightRecordToDelete.eveningWeightKg).toFixed(1))} kg)
                </button>
              )}
              <button
                type="button"
                onClick={() => handleDeleteRecord(weightRecordToDelete.id)}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-2xl shadow-sm transition cursor-pointer"
              >
                刪除整天紀錄
              </button>
              <button
                type="button"
                onClick={() => setWeightRecordToDelete(null)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-2xl transition cursor-pointer"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
