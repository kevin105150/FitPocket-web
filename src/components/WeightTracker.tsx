import React, { useState, useEffect } from 'react';
import { Scale, TrendingDown, TrendingUp, Minus, Calendar, Plus, Trash2, Edit2, Check } from 'lucide-react';
import { WeightRecord } from '../types';
import { StorageService } from '../services/storage';
import { DateNavigator } from './DateNavigator';

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
  const [morningTime, setMorningTime] = useState<string>('08:00');
  const [eveningWeight, setEveningWeight] = useState<string>('');
  const [eveningTime, setEveningTime] = useState<string>('21:30');
  const [chartDays, setChartDays] = useState<number>(7);
  const [userProfile, setUserProfile] = useState(StorageService.getUserProfile());

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
      setEveningWeight('');
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

  const handleDeleteRecord = (id: string) => {
    StorageService.deleteWeightRecord(id);
    refreshWeights();
  };

  // Compute latest weight and BMI
  const latestRecord = [...weightRecords].reverse().find(
    (r) => r.morningWeightKg || r.eveningWeightKg
  );
  const latestWeight =
    latestRecord?.morningWeightKg || latestRecord?.eveningWeightKg || userProfile.currentWeightKg;
  const heightM = (userProfile.heightCm || 175) / 100;
  const bmi = Math.round((latestWeight / (heightM * heightM)) * 10) / 10;

  // Chart data filter
  const sortedRecords = [...weightRecords].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const chartFiltered =
    chartDays === 0 ? sortedRecords : sortedRecords.slice(-chartDays);

  const validChartPoints = chartFiltered
    .map((r) => {
      const val = r.morningWeightKg || r.eveningWeightKg;
      return val ? { date: r.date.slice(5), weight: val } : null;
    })
    .filter(Boolean) as { date: string; weight: number }[];

  const minW = Math.min(...validChartPoints.map((p) => p.weight), userProfile.targetWeightKg) - 1;
  const maxW = Math.max(...validChartPoints.map((p) => p.weight), userProfile.targetWeightKg) + 1;
  const rangeW = maxW - minW || 1;

  return (
    <div className="space-y-4 pb-24 max-w-2xl mx-auto">
      {/* Date Navigator */}
      <DateNavigator currentDate={currentDate} onDateChange={onDateChange} />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs text-center">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            目前體重
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">
            {latestWeight} <span className="text-xs font-semibold text-slate-400">kg</span>
          </div>
          <div className="text-[10px] font-semibold text-emerald-700 mt-0.5">
            BMI {bmi}
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs text-center">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            目標體重
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">
            {userProfile.targetWeightKg}{' '}
            <span className="text-xs font-semibold text-slate-400">kg</span>
          </div>
          <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
            差距 {(latestWeight - userProfile.targetWeightKg).toFixed(1)} kg
          </div>
        </div>

        <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-2xs text-center">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            身高
          </div>
          <div className="text-xl font-black text-slate-900 mt-1">
            {userProfile.heightCm}{' '}
            <span className="text-xs font-semibold text-slate-400">cm</span>
          </div>
          <div className="text-[10px] font-semibold text-slate-400 mt-0.5">
            標準範圍 18.5-24
          </div>
        </div>
      </div>

      {/* Today Weight Log Form */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-2xs p-5">
        <h3 className="font-bold text-slate-900 text-sm mb-3">記錄 {currentDate} 體重</h3>
        <form onSubmit={handleSaveDayWeight} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Morning Weight */}
            <div className="bg-amber-50/50 border border-amber-200/60 p-3.5 rounded-2xl">
              <span className="text-xs font-bold text-amber-900 block mb-1">🌅 晨重 (空腹)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.1"
                  placeholder="例如: 72.4"
                  value={morningWeight}
                  onChange={(e) => setMorningWeight(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white rounded-xl border border-amber-200 text-base font-black text-slate-800 focus:outline-amber-600"
                />
                <span className="text-xs font-bold text-slate-500">kg</span>
              </div>
              <input
                type="time"
                value={morningTime}
                onChange={(e) => setMorningTime(e.target.value)}
                className="w-full mt-2 px-2 py-1 text-xs bg-white rounded-lg border border-amber-200 text-slate-600"
              />
            </div>

            {/* Evening Weight */}
            <div className="bg-indigo-50/50 border border-indigo-200/60 p-3.5 rounded-2xl">
              <span className="text-xs font-bold text-indigo-900 block mb-1">🌙 晚重 (睡前)</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.1"
                  placeholder="例如: 73.1"
                  value={eveningWeight}
                  onChange={(e) => setEveningWeight(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white rounded-xl border border-indigo-200 text-base font-black text-slate-800 focus:outline-indigo-600"
                />
                <span className="text-xs font-bold text-slate-500">kg</span>
              </div>
              <input
                type="time"
                value={eveningTime}
                onChange={(e) => setEveningTime(e.target.value)}
                className="w-full mt-2 px-2 py-1 text-xs bg-white rounded-lg border border-indigo-200 text-slate-600"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>儲存體重記錄</span>
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
                    ? 'bg-white text-emerald-800 shadow-2xs'
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
                  stroke="#10B981"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                />
              )}

              {/* Trend Polyline */}
              <polyline
                fill="none"
                stroke="#1B6A45"
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
                    <circle cx={x} cy={y} r="3.5" fill="#1B6A45" />
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
            <div key={rec.id} className="py-2.5 flex items-center justify-between">
              <div>
                <div className="font-bold text-xs text-slate-800">{rec.date}</div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                  {rec.morningWeightKg && (
                    <span>
                      晨: <strong className="text-amber-800">{rec.morningWeightKg} kg</strong> ({rec.morningTime || '早'})
                    </span>
                  )}
                  {rec.eveningWeightKg && (
                    <span>
                      晚: <strong className="text-indigo-800">{rec.eveningWeightKg} kg</strong> ({rec.eveningTime || '晚'})
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDeleteRecord(rec.id)}
                className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
