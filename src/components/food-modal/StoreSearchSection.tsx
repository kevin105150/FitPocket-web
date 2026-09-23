import React from 'react';
import { Search, Loader2, Store, RefreshCw, AlertCircle, ChevronDown, Check } from 'lucide-react';
import { FoodSearchResult, MealType } from '../../types';
import { FoodResultItem } from './FoodResultItem';

interface StoreSearchSectionProps {
  subStore: 'family' | 'mcd' | 'subway';
  setSubStore: (val: 'family' | 'mcd' | 'subway') => void;
  keyword: string;
  setKeyword: (val: string) => void;
  onSearch: (keyword?: string) => void;
  isSearching: boolean;
  results: FoodSearchResult[];
  error: string;
  successMsg: string;
  onSelectFood: (food: FoodSearchResult) => void;
  onFastAdd: (food: FoodSearchResult) => void;
  addedIds: Record<string, boolean>;
  isAdmin?: boolean;
  onCrawlAll?: () => void;
  isCrawlingAll?: boolean;
}

export const StoreSearchSection: React.FC<StoreSearchSectionProps> = ({
  subStore,
  setSubStore,
  keyword,
  setKeyword,
  onSearch,
  isSearching,
  results,
  error,
  successMsg,
  onSelectFood,
  onFastAdd,
  addedIds,
  isAdmin,
  onCrawlAll,
  isCrawlingAll,
}) => {
  return (
    <div className="space-y-4">
      {/* Sub-tab Switcher */}
      <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
        <button
          onClick={() => setSubStore('family')}
          className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
            subStore === 'family' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:bg-slate-200'
          }`}
        >
          <Store className="w-3 h-3" /> 全家便利商店
        </button>
        <button
          onClick={() => setSubStore('mcd')}
          className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
            subStore === 'mcd' ? 'bg-white text-red-700 shadow-xs' : 'text-slate-500 hover:bg-slate-200'
          }`}
        >
          <Store className="w-3 h-3" /> 麥當勞
        </button>
        <button
          onClick={() => setSubStore('subway')}
          className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
            subStore === 'subway' ? 'bg-white text-green-700 shadow-xs' : 'text-slate-500 hover:bg-slate-200'
          }`}
        >
          <Store className="w-3 h-3" /> Subway
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          placeholder={`搜尋${subStore === 'family' ? '全家' : subStore === 'mcd' ? '麥當勞' : 'Subway'}美食...`}
          className="w-full pl-10 pr-24 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-hidden"
        />
        <button
          onClick={() => onSearch()}
          disabled={isSearching}
          className="absolute right-2 top-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '搜尋'}
        </button>
      </div>

      {/* Admin Quick Actions */}
      {isAdmin && subStore !== 'family' && onCrawlAll && (
        <div className="flex gap-2">
          <button
            onClick={onCrawlAll}
            disabled={isCrawlingAll || isSearching}
            className="flex-1 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            {isCrawlingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            一鍵全量爬取官網並存入 Firebase
          </button>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 flex items-start gap-2 animate-in fade-in duration-200">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && !error && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 flex items-start gap-2 animate-in fade-in duration-200">
          <Check className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Results List */}
      <div className="space-y-2.5">
        {results.length > 0 ? (
          results.map((food) => (
            <FoodResultItem
              key={food.id}
              food={food}
              isAdded={!!addedIds[food.id]}
              onSelect={onSelectFood}
              onFastAdd={onFastAdd}
            />
          ))
        ) : (
          !isSearching && !error && (
            <div className="py-12 text-center space-y-3 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-xs mx-auto text-slate-300">
                <Store className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-500">
                  {subStore === 'family' ? '輸入關鍵字搜尋全家美食' : `點擊搜尋載入${subStore === 'mcd' ? '麥當勞' : 'Subway'}資料`}
                </p>
                <p className="text-[10px] text-slate-400">
                  即時連線官方資料庫庫存資料
                </p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
