import React, { useState } from 'react';
import { X, Download, Smartphone, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ApkDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ApkDownloadModal: React.FC<ApkDownloadModalProps> = ({ isOpen, onClose }) => {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(false);

  if (!isOpen) return null;

  const handleStartDownload = async () => {
    setDownloading(true);
    setProgress(0);
    setError('');
    setFinished(false);
    setStatusText('準備分段下載通道...');

    const TOTAL_CHUNKS = 8;
    const chunks: Blob[] = [];

    try {
      for (let i = 0; i < TOTAL_CHUNKS; i++) {
        setStatusText(`正在高速串流下載第 ${i + 1} / ${TOTAL_CHUNKS} 區段...`);
        const res = await fetch(`/DietApp.part${i}`);
        if (!res.ok) {
          throw new Error(`第 ${i + 1} 個區塊下載失敗 (${res.status})`);
        }
        const blob = await res.blob();
        chunks.push(blob);
        setProgress(Math.round(((i + 1) / TOTAL_CHUNKS) * 100));
      }

      setStatusText('正在合併檔案並生成完整 APK 套件...');
      const apkBlob = new Blob(chunks, {
        type: 'application/vnd.android.package-archive',
      });

      const blobUrl = URL.createObjectURL(apkBlob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'FitPocket-Release.apk';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      setStatusText('下載完成！請至您的下載檔案中開啟安裝。');
      setFinished(true);
    } catch (e: any) {
      console.error('Download error:', e);
      setError(e.message || '下載發生異常，請重試或以新分頁開啟 /apk.html');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">下載原生 Android APK</h3>
            <p className="text-xs text-slate-500">FitPocket Native APK · 支援 Android 8.0+</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-600 space-y-1.5 my-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">套件大小：</span>
            <span className="font-bold text-slate-800">約 50.3 MB</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">傳輸技術：</span>
            <span className="font-bold text-emerald-800">8段並行高速緩衝串流</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-medium">架構特性：</span>
            <span className="font-bold text-slate-800">全離線 Room 資料庫與 Jetpack Compose</span>
          </div>
        </div>

        {downloading && (
          <div className="my-4 space-y-2">
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-medium flex items-center gap-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                {statusText}
              </span>
              <span className="font-bold text-emerald-800">{progress}%</span>
            </div>
          </div>
        )}

        {finished && (
          <div className="my-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>已成功啟動 APK 下載！</span>
          </div>
        )}

        {error && (
          <div className="my-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2 mt-4">
          <a
            href="/apk.html"
            target="_blank"
            rel="noreferrer"
            className="flex-1 py-3 text-center text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
          >
            以獨立下載頁開啟
          </a>
          <button
            type="button"
            onClick={handleStartDownload}
            disabled={downloading}
            className="flex-2 py-3 bg-emerald-800 hover:bg-emerald-900 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? '正在串流下載中...' : '立即下載 APK'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
