import React from 'react';
import { Clock, Check, Plus, History } from 'lucide-react';
import { FoodRecord, FoodSearchResult } from '../../types';

interface RecentHistorySectionProps {
  records: FoodRecord[];
  onQuickAdd: (record: FoodRecord) => void;
  onSelect: (food: FoodSearchResult) => void;
  animatingId: string | null;
  formatTime: (ts: number) => string;
  mapRecordToSearch: (r: FoodRecord) => FoodSearchResult;
  selectedMealName: string;
}

export const RecentHistorySection: React.FC<RecentHistorySectionProps> = ({
  records,
  onQuickAdd,
  onSelect,
  animatingId,
  formatTime,
  mapRecordToSearch,
  selectedMealName,
}) => {
  if (records.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" />
          <h4 className="font-extrabold text-slate-700 text-xs">
            最近吃過的{selectedMealName}
          </h4>
        </div>
      </div>
      <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide no-scrollbar">
        {records.map((record) => {
          const isAnimating = animatingId === record.id;
          return (
            <div
              key={record.id}
              className={`relative flex-none w-32 bg-white border border-slate-100 rounded-2xl p-2.5 transition-all active:scale-95 shadow-xs ${
                isAnimating ? 'ring-2 ring-emerald-500 bg-emerald-50' : 'hover:border-blue-200'
              }`}
            >
              <div 
                className="cursor-pointer"
                onClick={() => onSelect(mapRecordToSearch(record))}
              >
                <div className="text-[9px] text-slate-400 font-bold mb-1 flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  {formatTime(record.createdAt)}
                </div>
                <h5 className="text-[11px] font-extrabold text-slate-800 line-clamp-2 min-h-[2.5em]">
                  {record.name}
                </h5>
                <div className="mt-2 text-[10px] font-bold text-blue-600">
                  {record.calories} <span className="text-[8px] opacity-70">kcal</span>
                </div>
              </div>
              <button
                onClick={() => onQuickAdd(record)}
                className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center shadow-sm transition-transform cursor-pointer active:scale-125 ${
                  isAnimating ? 'bg-emerald-500 text-white scale-110' : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isAnimating ? <Check className="w-4 h-4" /> : <Plus className="w-3 h-3" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
