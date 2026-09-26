import React, { useState, useEffect } from 'react';
import { Scale, TrendingDown, TrendingUp, Minus, Calendar, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { WeightRecord } from '../types';
import { StorageService } from '../services/storage';
import { DateNavigator } from './DateNavigator';
import { motion, AnimatePresence } from 'motion/react';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

interface WeightTrackerProps {
  currentDate: string;
  onDateChange: (date: string) => void;
}

export const WeightTracker: React.FC<WeightTrackerProps> = ({
  currentDate,
  onDateChange,
}) => {
  const [weightRecords, setWeightRecords] = useState<WeightRecord[]>([]);
  const [chartDays, setChartDays] = useState<number>(7);
  const [userProfile, setUserProfile] = useState(StorageService.getUserProfile());

  const [activeChartTab, setActiveChartTab] = useState<'morning' | 'evening'>(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'morning' : 'evening';
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalDate, setModalDate] = useState<string>(currentDate);
  const [modalTab, setModalTab] = useState<'morning' | 'evening'>('morning');
  const [modalWeight, setModalWeight] = useState<string>('');
  const [modalTime, setModalTime] = useState<string>('08:00');

  const [weightRecordToDelete, setWeightRecordToDelete] = useState<WeightRecord | null>(null);
  const [confirmSwipeDeleteId, setConfirmSwipeDeleteId] = useState<string | null>(null);

  useModalBackHandler(isModalOpen, () => setIsModalOpen(false));
  useModalBackHandler(weightRecordToDelete !== null, () => setWeightRecordToDelete(null));

  const refreshWeights = () => {
    const all = StorageService.getAllWeightRecords().sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    setWeightRecords(all);
    setUserProfile(StorageService.getUserProfile());
  };

  useEffect(() => {
    refreshWeights();
    const unsubscribe = StorageService.onDataChange(() => {
      refreshWeights();
    });
    return () => unsubscribe();
  }, [currentDate]);

  const handleOpenModal = (date: string, tab?: 'morning' | 'evening') => {
    const hour = new Date().getHours();
    const targetTab = tab || (hour < 12 ? 'morning' : 'evening');
    setModalDate(date);
    setModalTab(targetTab);

    const rec = StorageService.getAllWeightRecords().find((r) => r.date === date);
    if (targetTab === 'morning') {
      setModalWeight(rec?.morningWeightKg != null ? String(rec.morningWeightKg) : '');
      setModalTime(rec?.morningTime || (date === currentDate ? new Date().toTimeString().slice(0, 5) : '08:00'));
    } else {
      setModalWeight(rec?.eveningWeightKg != null ? String(rec.eveningWeightKg) : '');
      setModalTime(rec?.eveningTime || (date === currentDate ? new Date().toTimeString().slice(0, 5) : '21:30'));
    }
    setIsModalOpen(true);
  };

  const handleSwitchModalTab = (tab: 'morning' | 'evening') => {
    setModalTab(tab);
    const rec = StorageService.getAllWeightRecords().find((r) => r.date === modalDate);
    if (tab === 'morning') {
      setModalWeight(rec?.morningWeightKg != null ? String(rec.morningWeightKg) : '');
      setModalTime(rec?.morningTime || (modalDate === currentDate ? new Date().toTimeString().slice(0, 5) : '08:00'));
    } else {
      setModalWeight(rec?.eveningWeightKg != null ? String(rec.eveningWeightKg) : '');
      setModalTime(rec?.eveningTime || (modalDate === currentDate ? new Date().toTimeString().slice(0, 5) : '21:30'));
    }
  };

  const handleSaveModalWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const all = StorageService.getAllWeightRecords();
    const existingRecord = all.find((r) => r.date === modalDate);

    const parsedWeight = modalWeight.trim() ? parseFloat(modalWeight) : null;
    const timeVal = parsedWeight !== null ? (modalTime || (modalTab === 'morning' ? '08:00' : '21:30')) : null;

    let morningWeightKg = existingRecord?.morningWeightKg ?? null;
    let morningTime = existingRecord?.morningTime ?? null;
    let eveningWeightKg = existingRecord?.eveningWeightKg ?? null;
    let eveningTime = existingRecord?.eveningTime ?? null;

    if (modalTab === 'morning') {
      morningWeightKg = parsedWeight;
      morningTime = timeVal;
    } else {
      eveningWeightKg = parsedWeight;
      eveningTime = timeVal;
    }

    if (morningWeightKg === null && eveningWeightKg === null) {
      if (existingRecord) {
        StorageService.deleteWeightRecord(existingRecord.id);
      }
    } else {
      const record: WeightRecord = {
        id: existingRecord?.id || 'weight_' + Date.now(),
        date: modalDate,
        morningWeightKg,
        morningTime,
        eveningWeightKg,
        eveningTime,
        createdAt: existingRecord?.createdAt || Date.now(),
      };
      StorageService.saveWeightRecord(record);
    }

    refreshWeights();
    setIsModalOpen(false);
  };

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

  // Chart data filter
  const sortedRecords = [...weightRecords].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Filter for chart based on tab
  const getChartPoints = (type: 'morning' | 'evening') => {
    return sortedRecords
      .map((r) => {
        const val = type === 'morning' ? r.morningWeightKg : r.eveningWeightKg;
        return val ? { date: r.date.slice(5), weight: val } : null;
      })
      .filter(Boolean) as { date: string; weight: number }[];
  };

  const allValidPoints = getChartPoints(activeChartTab);
  const validChartPoints = chartDays === 0 ? allValidPoints : allValidPoints.slice(-chartDays);

  const minW = Math.min(...(validChartPoints.length ? validChartPoints.map((p) => p.weight) : [userProfile.targetWeightKg || 60]), userProfile.targetWeightKg || 60) - 1;
  const maxW = Math.max(...(validChartPoints.length ? validChartPoints.map((p) => p.weight) : [userProfile.targetWeightKg || 60]), userProfile.targetWeightKg || 60) + 1;
  const rangeW = maxW - minW || 1;

  return (
    <div className="space-y-4 pb-28 max-w-2xl mx-auto relative">
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
              const last = [...weightRecords].reverse().find((r) => r.morningWeightKg);
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
              const last = [...weightRecords].reverse().find((r) => r.eveningWeightKg);
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
            {parseFloat(Number(userProfile.targetWeightKg || 0).toFixed(1))}{' '}
            <span className="text-xs font-semibold text-slate-400">kg</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs text-center">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            身高
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">
            {parseFloat(Number(userProfile.heightCm || 0).toFixed(1))}{' '}
            <span className="text-xs font-semibold text-slate-400">cm</span>
          </div>
        </div>
      </div>

      {/* Weight Trend Chart */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5">
        <div className="flex flex-col gap-2.5 mb-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-slate-900 text-sm">體重趨勢圖表</h3>

            {/* 早上 / 晚上 (右上角) */}
            <div className="flex bg-slate-100 p-0.5 sm:p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveChartTab('morning')}
                className={`px-2.5 py-0.5 sm:py-1 rounded-lg transition cursor-pointer ${
                  activeChartTab === 'morning'
                    ? 'bg-amber-100 text-amber-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                早上
              </button>
              <button
                type="button"
                onClick={() => setActiveChartTab('evening')}
                className={`px-2.5 py-0.5 sm:py-1 rounded-lg transition cursor-pointer ${
                  activeChartTab === 'evening'
                    ? 'bg-indigo-100 text-indigo-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                晚上
              </button>
            </div>
          </div>

          {/* Days Filter (Left) */}
          <div className="flex gap-1 bg-slate-100 p-0.5 sm:p-1 rounded-xl self-start -ml-0.5 sm:-ml-1">
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
                className={`px-2 py-0.5 sm:px-2.5 sm:py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
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
                stroke={activeChartTab === 'morning' ? '#d97706' : '#4f46e5'}
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
                    <circle cx={x} cy={y} r="3.5" fill={activeChartTab === 'morning' ? '#d97706' : '#4f46e5'} />
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
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-slate-900 text-sm">近期體重記錄</h3>
          <span className="text-[11px] text-slate-400">點擊筆圖示可快速編輯</span>
        </div>
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
                let slideDist = 85;
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
                              <span className="text-amber-800 font-black text-[11px] truncate">
                                {parseFloat(Number(rec.morningWeightKg).toFixed(1))}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-medium">--</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenModal(rec.date, 'morning')}
                            className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-100 rounded-lg transition cursor-pointer shrink-0"
                            title={rec.morningWeightKg ? '編輯晨間體重' : '新增晨間體重'}
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Evening Weight Segment */}
                        <div className="flex items-center justify-between w-[115px] bg-indigo-50/50 border border-indigo-100/50 px-2 py-1 rounded-xl">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] text-indigo-900 font-semibold shrink-0">晚重</span>
                            {rec.eveningWeightKg != null ? (
                              <span className="text-indigo-800 font-black text-[11px] truncate">
                                {parseFloat(Number(rec.eveningWeightKg).toFixed(1))}
                              </span>
                            ) : (
                              <span className="text-slate-300 font-medium">--</span>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleOpenModal(rec.date, 'evening')}
                            className="p-1 text-slate-400 hover:text-indigo-700 hover:bg-indigo-100 rounded-lg transition cursor-pointer shrink-0"
                            title={rec.eveningWeightKg ? '編輯晚間體重' : '新增晚間體重'}
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

      {/* Floating Action Button (+) */}
      <button
        type="button"
        onClick={() => handleOpenModal(currentDate)}
        className="fixed right-5 bottom-20 sm:right-8 sm:bottom-24 z-40 w-14 h-14 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-full shadow-lg shadow-sky-600/30 flex items-center justify-center transition-all duration-200 cursor-pointer group"
        aria-label="記錄體重"
        title="記錄體重"
      >
        <Plus className="w-7 h-7 stroke-[2.5] group-hover:rotate-90 transition-transform duration-200" />
      </button>

      {/* Weight Record Dialog / Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="absolute inset-0" onClick={() => setIsModalOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.15 }}
              className="bg-white rounded-[32px] max-w-md w-full p-6 shadow-2xl border border-slate-100 relative z-10 space-y-4"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-1">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl bg-sky-100 text-sky-800 flex items-center justify-center">
                    <Scale className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">記錄體重</h3>
                    <p className="text-[11px] font-bold text-slate-400">📅 {modalDate}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tab Switcher */}
              <div className="bg-slate-100/80 p-1 rounded-2xl flex gap-1">
                <button
                  type="button"
                  onClick={() => handleSwitchModalTab('morning')}
                  className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    modalTab === 'morning'
                      ? 'bg-amber-100 text-amber-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span>🌅</span>
                  <span>早上體重</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchModalTab('evening')}
                  className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    modalTab === 'evening'
                      ? 'bg-indigo-100 text-indigo-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span>🌙</span>
                  <span>晚上體重</span>
                </button>
              </div>

              {/* Form Entry Area */}
              <form onSubmit={handleSaveModalWeight} className="space-y-4 pt-1.5">
                <div
                  className={`p-4 rounded-2xl border transition-colors ${
                    modalTab === 'morning'
                      ? 'bg-amber-50/50 border-amber-200/60'
                      : 'bg-indigo-50/50 border-indigo-200/60'
                  }`}
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-slate-700">
                      {modalTab === 'morning' ? '🌅 早上體重 (空腹)' : '🌙 晚上體重 (睡前)'}
                    </span>
                    <input
                      type="time"
                      value={modalTime}
                      onChange={(e) => setModalTime(e.target.value)}
                      className="px-2.5 py-1 text-xs font-bold bg-white rounded-lg border border-slate-200 text-slate-700 shadow-2xs focus:outline-sky-600"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      value={modalWeight}
                      onChange={(e) => setModalWeight(e.target.value)}
                      className="w-1/2 max-w-[150px] px-3 py-1.5 bg-white rounded-xl border border-slate-200 text-base font-black text-slate-800 text-center focus:outline-sky-600 shadow-2xs"
                    />
                    <span className="text-sm font-bold text-slate-500 shrink-0">kg</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-1.5">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm rounded-2xl transition cursor-pointer"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-3 bg-sky-600 hover:bg-sky-700 active:scale-[0.99] text-white font-black text-sm rounded-2xl shadow-md shadow-sky-600/25 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>儲存 {modalTab === 'morning' ? '早上' : '晚上'} 體重</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
