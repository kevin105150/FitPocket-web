import React, { useState } from 'react';
import { Navigation, TabType } from './components/Navigation';
import { DietTracker } from './components/DietTracker';
import { TrainingTracker } from './components/TrainingTracker';
import { WaterTracker } from './components/WaterTracker';
import { WeightTracker } from './components/WeightTracker';
import { SettingsScreen } from './components/SettingsScreen';
import { ApkDownloadModal } from './components/ApkDownloadModal';
import { Smartphone } from 'lucide-react';
import { getTodayString } from './utils/dateUtils';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('DIET');
  const [currentDate, setCurrentDate] = useState<string>(getTodayString);

  const [showApkModal, setShowApkModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#F7FAF7] flex flex-col antialiased text-slate-800">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-emerald-950/5">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-800 text-white flex items-center justify-center font-black text-base shadow-xs">
              FP
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 tracking-tight leading-none">
                FitPocket
              </h1>
              <span className="text-[10px] font-semibold text-emerald-800 tracking-wider">
                AI DIET & TRAINING
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowApkModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-xl text-xs font-bold transition cursor-pointer border border-emerald-200/50"
              title="下載 Android 原生 APK"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">下載</span> APK
            </button>
          </div>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-5">
        {activeTab === 'DIET' && (
          <DietTracker currentDate={currentDate} onDateChange={setCurrentDate} />
        )}

        {activeTab === 'TRAINING' && (
          <TrainingTracker currentDate={currentDate} onDateChange={setCurrentDate} />
        )}

        {activeTab === 'WATER' && (
          <WaterTracker currentDate={currentDate} onDateChange={setCurrentDate} />
        )}

        {activeTab === 'WEIGHT' && (
          <WeightTracker currentDate={currentDate} onDateChange={setCurrentDate} />
        )}

        {activeTab === 'SETTINGS' && <SettingsScreen />}
      </main>

      {/* Bottom Navigation */}
      <Navigation activeTab={activeTab} onChangeTab={setActiveTab} />

      {/* APK Downloader Modal */}
      {showApkModal && (
        <ApkDownloadModal isOpen={showApkModal} onClose={() => setShowApkModal(false)} />
      )}
    </div>
  );
}
