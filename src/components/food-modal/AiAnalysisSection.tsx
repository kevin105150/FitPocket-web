import React from 'react';
import { Sparkles, Loader2, Camera, Image, Send, AlertCircle, RefreshCw } from 'lucide-react';

interface AiAnalysisSectionProps {
  aiPrompt: string;
  setAiPrompt: (val: string) => void;
  onTextAnalyze: () => void;
  aiLoading: boolean;
  aiProgress: number;
  aiStatus: string;
  aiError: string;
  onCameraOpen: () => void;
  onGalleryOpen: () => void;
  onRetry: (() => void) | null;
}

export const AiAnalysisSection: React.FC<AiAnalysisSectionProps> = ({
  aiPrompt,
  setAiPrompt,
  onTextAnalyze,
  aiLoading,
  aiProgress,
  aiStatus,
  aiError,
  onCameraOpen,
  onGalleryOpen,
  onRetry,
}) => {
  return (
    <div className="space-y-5 py-2">
      {/* Visual Analysis Cards */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onCameraOpen}
          className="group flex flex-col items-center gap-3 p-5 rounded-3xl bg-blue-600 hover:bg-blue-700 text-white transition shadow-lg shadow-blue-200 active:scale-95 cursor-pointer"
        >
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition">
            <Camera className="w-6 h-6" />
          </div>
          <div className="text-center">
            <h4 className="font-extrabold text-sm">相機辨識</h4>
            <p className="text-[10px] opacity-80 mt-0.5">拍照自動計算營養</p>
          </div>
        </button>

        <button
          onClick={onGalleryOpen}
          className="group flex flex-col items-center gap-3 p-5 rounded-3xl bg-white border-2 border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition shadow-sm active:scale-95 cursor-pointer"
        >
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition">
            <Image className="w-6 h-6" />
          </div>
          <div className="text-center">
            <h4 className="font-extrabold text-sm text-slate-800">相簿上傳</h4>
            <p className="text-[10px] text-slate-500 mt-0.5">由 AI 分析既有照片</p>
          </div>
        </button>
      </div>

      {/* Text Description Analysis */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1 h-4 bg-blue-600 rounded-full" />
          <h4 className="font-extrabold text-slate-800 text-xs">文字智慧估算 (AI 營養師)</h4>
        </div>
        <div className="relative group">
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="例如：一碗牛肉麵配一顆滷蛋、或者是今天早餐吃了兩片全麥吐司加火腿蛋..."
            className="w-full min-h-[100px] p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs leading-relaxed focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-hidden resize-none"
          />
          <button
            onClick={onTextAnalyze}
            disabled={aiLoading || !aiPrompt.trim()}
            className="absolute right-3 bottom-3 p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl shadow-lg transition active:scale-90 cursor-pointer"
          >
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Analysis Status */}
      {aiLoading && (
        <div className="p-5 bg-blue-50/80 rounded-3xl border border-blue-100 space-y-3 backdrop-blur-md">
          <div className="flex items-center justify-between text-[11px] font-bold text-blue-900">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{aiStatus}</span>
            </div>
            <span>{aiProgress}%</span>
          </div>
          <div className="h-1.5 bg-blue-200/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-500" 
              style={{ width: `${aiProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Error State */}
      {aiError && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h5 className="font-extrabold text-rose-800 text-[11px]">AI 辨識異常</h5>
              <p className="text-[10px] text-rose-600 leading-relaxed">{aiError}</p>
            </div>
          </div>
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl text-[10px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" /> 重新嘗試
            </button>
          )}
        </div>
      )}
    </div>
  );
};
