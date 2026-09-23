import React from 'react';
import { Plus, Check, Globe, Store, Flame, Database, Info } from 'lucide-react';
import { FoodSearchResult } from '../../types';

interface FoodResultItemProps {
  food: FoodSearchResult;
  isAdded: boolean;
  onSelect: (food: FoodSearchResult) => void;
  onFastAdd: (food: FoodSearchResult) => void;
}

export const FoodResultItem: React.FC<FoodResultItemProps> = ({
  food,
  isAdded,
  onSelect,
  onFastAdd,
}) => {
  return (
    <div className="group relative bg-white border border-slate-100 rounded-2xl p-3 hover:border-blue-200 hover:shadow-md transition-all active:scale-[0.98]">
      <div className="flex items-center justify-between gap-3">
        {/* Info & Metadata */}
        <div className="flex-1 min-w-0" onClick={() => onSelect(food)}>
          <div className="flex items-center gap-1.5 mb-1">
            {food.brand?.includes('衛福部') || food.id.startsWith('tfda_') ? (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 text-[10px] font-bold text-emerald-600 border border-emerald-100">
                <Database className="w-2.5 h-2.5" /> 官方
              </span>
            ) : food.brand?.includes('全家') || food.id.startsWith('family_') ? (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-blue-50 text-[10px] font-bold text-blue-600 border border-blue-100">
                <Store className="w-2.5 h-2.5" /> 全家
              </span>
            ) : food.brand?.includes('麥當勞') || food.id.startsWith('mcd_') ? (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-red-50 text-[10px] font-bold text-red-600 border border-red-100">
                <Store className="w-2.5 h-2.5" /> 麥當勞
              </span>
            ) : food.brand?.includes('Subway') || food.id.startsWith('subway_') ? (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-green-50 text-[10px] font-bold text-green-600 border border-green-100">
                <Store className="w-2.5 h-2.5" /> Subway
              </span>
            ) : food.isOpenFood ? (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-indigo-50 text-[10px] font-bold text-indigo-600 border border-indigo-100">
                <Globe className="w-2.5 h-2.5" /> 全球庫
              </span>
            ) : food.isUserCustom ? (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-purple-50 text-[10px] font-bold text-purple-600 border border-purple-100">
                自訂
              </span>
            ) : null}
            <span className="text-[10px] text-slate-400 font-medium truncate">
              {food.brand || '一般食材'}
            </span>
          </div>
          <h4 className="font-extrabold text-slate-800 text-sm truncate group-hover:text-blue-700 transition">
            {food.name}
          </h4>
          <div className="flex items-center gap-3 mt-1.5">
            <div className="flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-500" />
              <span className="text-xs font-bold text-slate-600">{food.calories} <span className="text-[10px] font-normal opacity-70">kcal</span></span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium bg-slate-50 px-1.5 py-0.5 rounded-md">
              {food.servingAmount}{food.servingUnit}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onSelect(food)}
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition cursor-pointer"
            title="查看詳情"
          >
            <Info className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={() => onFastAdd(food)}
            disabled={isAdded}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition shadow-xs cursor-pointer ${
              isAdded
                ? 'bg-emerald-500 text-white shadow-emerald-200'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 active:scale-90'
            }`}
          >
            {isAdded ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
