import React, { useState } from 'react';
import { Calendar, FileText, Download, X, Info, Check } from 'lucide-react';
import { getTodayString, addDays, formatChineseDisplayDate } from '../utils/dateUtils';
import { StorageService } from '../services/storage';
import { generateFullAppExportHtml } from '../utils/htmlExporter';

interface ExportHtmlModalProps {
  onClose: () => void;
  onSuccessMessage?: (msg: string) => void;
}

export const ExportHtmlModal: React.FC<ExportHtmlModalProps> = ({
  onClose,
  onSuccessMessage,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(getTodayString());
  const startDate = addDays(selectedDate, -6);
  const endDate = selectedDate;

  const handleExecuteExport = () => {
    // 1. Get raw export data
    const rawDataJson = StorageService.exportData();
    const parsedData = JSON.parse(rawDataJson);

    // 2. Filter records for the 7-day range [startDate, endDate]
    const filteredFoodRecords = (parsedData.foodRecords || []).filter(
      (r: any) => r.date >= startDate && r.date <= endDate
    );
    const filteredWaterRecords = (parsedData.waterRecords || []).filter(
      (r: any) => r.date >= startDate && r.date <= endDate
    );
    const filteredWorkoutRecords = (parsedData.workoutRecords || []).filter(
      (r: any) => r.date >= startDate && r.date <= endDate
    );
    const filteredWeightRecords = (parsedData.weightRecords || []).filter(
      (r: any) => r.date >= startDate && r.date <= endDate
    );

    const exportPayload = {
      ...parsedData,
      foodRecords: filteredFoodRecords,
      waterRecords: filteredWaterRecords,
      workoutRecords: filteredWorkoutRecords,
      weightRecords: filteredWeightRecords,
    };

    // 3. Generate HTML with initial viewed date set to selectedDate
    const htmlContent = generateFullAppExportHtml(exportPayload, {
      selectedDate: endDate,
      startDate,
      endDate,
    });

    // 4. Download file
    const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitpocket_7days_report_${startDate}_to_${endDate}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (onSuccessMessage) {
      onSuccessMessage(`已成功匯出 ${startDate} ～ ${endDate} (7天) 完整 HTML 報表！`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative z-10 flex flex-col animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-800 rounded-2xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">匯出 7 日健康報表 (HTML)</h3>
              <p className="text-xs text-slate-500">選擇基準日往前匯出完整 7 天數據</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Prompt / Hint Notice */}
          <div className="p-3.5 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex items-start gap-3 text-emerald-900">
            <Info className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed space-y-1">
              <div className="font-bold">匯出範圍說明</div>
              <p className="text-emerald-800">
                系統將自動擷取您所選基準日（含）往前推算 <strong className="font-bold text-emerald-950">7 天</strong> 之每日飲食、水分、健身訓練及體重數據，產生單一便攜的 HTML 檔案，支援離線瀏覽、圖表分析與列印。
              </p>
            </div>
          </div>

          {/* Date Picker Section */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700">
              選擇匯出基準日（結束日期）
            </label>
            <div className="relative flex items-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value || getTodayString())}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute right-4 pointer-events-none" />
            </div>
            <p className="text-[11px] text-slate-400">
              {formatChineseDisplayDate(selectedDate)}
            </p>
          </div>

          {/* Calculated 7-Day Range Card */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/70 space-y-2">
            <div className="text-xs font-semibold text-slate-500">
              匯出涵蓋日期區間（共 7 天）
            </div>
            <div className="flex items-center justify-between font-black text-slate-800 text-sm">
              <span className="bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                {startDate}
              </span>
              <span className="text-slate-400 font-normal">至</span>
              <span className="bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                {endDate}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            取消
          </button>

          <button
            type="button"
            onClick={handleExecuteExport}
            className="px-5 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>立即匯出 7 日 HTML 報表</span>
          </button>
        </div>
      </div>
    </div>
  );
};
