import React, { useState } from 'react';
import { X, Sparkles, Plus, Check, Loader2, Store } from 'lucide-react';
import { FamilyCacheService } from '../services/familyCacheService';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

interface BatchCrawlModalProps {
  onClose: () => void;
  onFinished: (totalCount: number) => void;
}

const DEFAULT_20_ITEMS = [
  '飯糰', '茶葉蛋', '地瓜', '雞胸肉', '沙拉', 
  '鮮乳', '豆漿', '貝果', '麵包', '優格', 
  '關東煮', '涼麵', '吐司', '茶', '燕麥奶', 
  '蛋白飲', '三明治', '手卷', '熱壓吐司', '烏龍麵'
];

export const BatchCrawlModal: React.FC<BatchCrawlModalProps> = ({ onClose, onFinished }) => {
  useModalBackHandler(true, onClose);

  const [selectedKeywords, setSelectedKeywords] = useState<string[]>(['飯糰', '茶葉蛋', '地瓜', '雞胸肉', '沙拉']);
  const [customKeywords, setCustomKeywords] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [forceUpdate, setForceUpdate] = useState(false);
  const [isCrawling, setIsCrawling] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const allItems = [...DEFAULT_20_ITEMS, ...customKeywords];

  const handleClearCache = () => {
    FamilyCacheService.clearAllLocalCache();
    setSuccessMsg('已清除本地所有全家搜尋快取。下一次爬取將優先檢查雲端。');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const toggleKeyword = (kw: string) => {
    if (selectedKeywords.includes(kw)) {
      setSelectedKeywords(selectedKeywords.filter(k => k !== kw));
    } else {
      setSelectedKeywords([...selectedKeywords, kw]);
    }
  };

  const handleAddCustom = () => {
    const kw = customInput.trim();
    if (!kw) return;
    if (!allItems.includes(kw)) {
      setCustomKeywords([...customKeywords, kw]);
    }
    if (!selectedKeywords.includes(kw)) {
      setSelectedKeywords([...selectedKeywords, kw]);
    }
    setCustomInput('');
  };

  const handleRunBatchCrawl = async () => {
    if (selectedKeywords.length === 0) return;
    setIsCrawling(true);
    setSuccessMsg('');

    let totalFetched = 0;
    let totalFromCache = 0;
    try {
      for (let i = 0; i < selectedKeywords.length; i++) {
        const kw = selectedKeywords[i];
        setProgressText(`正在檢查/更新 (${i + 1}/${selectedKeywords.length}): ${kw}...`);

        // 方案二：優先檢查雲端與本地快取 (若開啟強制更新則跳過此步)
        let products = forceUpdate ? null : await FamilyCacheService.getCachedFamilySearch(kw);

        if (!products || products.length === 0) {
          // 若無快取或強制更新，則發動爬蟲
          try {
            const res = await fetch('/api/family/search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ keyword: kw })
            });
            
            if (res.ok) {
              const data = await res.json();
              if (data.products && Array.isArray(data.products)) {
                // 寫入快取 (Service 內部會處理三大營養素比對，避免重複寫入髒資料)
                const filtered = await FamilyCacheService.setCachedFamilySearch(kw, data.products);
                totalFetched += filtered.length;
              }
            } else {
              const errData = await res.json().catch(() => ({}));
              console.warn(`[BatchCrawl] API failed for ${kw}:`, errData);
            }
          } catch (fetchErr: any) {
            console.error(`[BatchCrawl] Network error for ${kw}:`, fetchErr);
            // Don't alert here to avoid interrupting the loop, just log
          }
        } else {
          // 已有快取，跳過爬取，直接計入 (實現跨使用者共享資料庫與零重複爬蟲)
          totalFromCache += products.length;
        }
      }
      setSuccessMsg(`批次同步完畢！${totalFromCache > 0 ? `從快取載入 ${totalFromCache} 筆，` : ''}新爬取 ${totalFetched} 筆商品資料。`);
      setTimeout(() => {
        onFinished(totalFetched);
      }, 2500);
    } catch (err: any) {
      console.error(err);
      alert(err.message || '批次爬蟲發生錯誤');
    } finally {
      setIsCrawling(false);
      setProgressText('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600 text-white rounded-2xl shadow-sm">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">全家便利商店 - 智慧批次爬蟲</h3>
              <p className="text-xs text-emerald-700">自動抓取最新品項與營養標示，隨時同步超商新品</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isCrawling}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 relative">
          {successMsg && (
            <div className="sticky top-0 z-20 mb-4 p-4 bg-emerald-500 text-white border border-emerald-400 rounded-2xl text-xs font-black flex items-center justify-between shadow-lg animate-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button 
                onClick={() => setSuccessMsg('')}
                className="p-1 hover:bg-emerald-600 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between gap-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl">
            <div className="flex-1">
              <h4 className="text-xs font-black text-emerald-900">重新整理本地快取</h4>
              <p className="text-[10px] text-emerald-700 mt-0.5">若超商推出新品但您的搜尋結果未更新，可嘗試清除本地快取。</p>
            </div>
            <button
              type="button"
              onClick={handleClearCache}
              disabled={isCrawling}
              className="px-4 py-2 bg-white text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold hover:bg-emerald-100 transition cursor-pointer shadow-2xs whitespace-nowrap"
            >
              一鍵清除本地快取
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">精選 20 項熱門超商分類與新品關鍵字</span>
              <span className="text-xs font-black text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
                已選 {selectedKeywords.length} 項
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">
              勾選您要更新的項目（不限數量），系統將重新向全家官網抓取最新資料：
            </p>

            <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-2 bg-slate-50 border border-slate-200/80 rounded-2xl">
              {allItems.map((kw) => {
                const isSelected = selectedKeywords.includes(kw);
                return (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => toggleKeyword(kw)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs scale-102'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                    {kw}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
             <div className="flex-1">
               <h4 className="text-xs font-black text-slate-900">強制向官網重新爬取</h4>
               <p className="text-[10px] text-slate-500 mt-0.5">開啟後將跳過雲端與本地快取，直接連線至全家官網獲取即時資訊。</p>
             </div>
             <label className="relative inline-flex items-center cursor-pointer">
               <input 
                 type="checkbox" 
                 className="sr-only peer" 
                 checked={forceUpdate} 
                 onChange={(e) => setForceUpdate(e.target.checked)} 
               />
               <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
             </label>
          </div>

          {/* Custom Keyword Input */}
          <div className="space-y-2 bg-slate-50 border border-slate-200/80 p-4 rounded-2xl">
            <label className="block text-xs font-bold text-slate-700">新增自訂爬蟲關鍵字</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="例如: 貝果, 蛋白質飲, 烤雞..."
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
                className="flex-1 px-3 py-2.5 bg-white rounded-xl border border-slate-200 text-xs focus:outline-emerald-600"
              />
              <button
                type="button"
                onClick={handleAddCustom}
                disabled={!customInput.trim()}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50 whitespace-nowrap flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                加入選取
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isCrawling}
            className="px-5 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-2xl transition cursor-pointer"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleRunBatchCrawl}
            disabled={isCrawling || selectedKeywords.length === 0}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isCrawling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{progressText}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>開始執行批次爬蟲 ({selectedKeywords.length} 項)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
