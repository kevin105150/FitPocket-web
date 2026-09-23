import React from 'react';
import { Barcode, Search, Loader2, AlertCircle, Camera } from 'lucide-react';

interface BarcodeSectionProps {
  barcodeInput: string;
  setBarcodeInput: (val: string) => void;
  onLookup: (code: string) => void;
  isLoading: boolean;
  error: string;
  onOpenScanner: () => void;
}

export const BarcodeSection: React.FC<BarcodeSectionProps> = ({
  barcodeInput,
  setBarcodeInput,
  onLookup,
  isLoading,
  error,
  onOpenScanner,
}) => {
  return (
    <div className="space-y-6 py-2">
      {/* Visual Scanner Entry */}
      <button
        onClick={onOpenScanner}
        className="w-full group flex flex-col items-center gap-4 p-8 rounded-3xl bg-slate-900 text-white transition hover:bg-slate-800 shadow-xl shadow-slate-200 active:scale-98 cursor-pointer"
      >
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center group-hover:scale-110 transition border border-white/20">
            <Barcode className="w-8 h-8" />
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-slate-900">
            <Camera className="w-2.5 h-2.5" />
          </div>
        </div>
        <div className="text-center">
          <h4 className="font-extrabold text-base">開啟條碼掃描鏡頭</h4>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            支援 國際條碼 (EAN-13)、UPC、Code 128 等<br />
            對準商品條碼後即可自動辨識
          </p>
        </div>
      </button>

      {/* Manual Input Search */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1 h-4 bg-slate-400 rounded-full" />
          <h4 className="font-extrabold text-slate-700 text-xs text-center">或手動輸入條碼編號</h4>
        </div>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
            <Barcode className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onLookup(barcodeInput)}
            placeholder="請輸入商品包裝上的國際條碼數字..."
            className="w-full pl-10 pr-24 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-hidden font-mono"
          />
          <button
            onClick={() => onLookup(barcodeInput)}
            disabled={isLoading || !barcodeInput.trim()}
            className="absolute right-2 top-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '查詢'}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 flex items-start gap-2 animate-in fade-in duration-200">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Helper Tips */}
      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-[10px] text-slate-500 leading-relaxed">
        <p className="font-bold mb-1">💡 掃描小技巧：</p>
        <ul className="list-disc pl-3.5 space-y-1">
          <li>確保光線充足且避免條碼處反光。</li>
          <li>鏡頭離條碼約 10-15 公分，並等待自動對焦。</li>
          <li>若為常見超商美食，亦可使用「AI 飲食相機」辨識整個包裝。</li>
        </ul>
      </div>
    </div>
  );
};
