import React, { useState, useEffect } from 'react';
import { Navigation, TabType } from './components/Navigation';
import { DietTracker } from './components/DietTracker';
import { TrainingTracker } from './components/TrainingTracker';
import { WaterTracker } from './components/WaterTracker';
import { WeightTracker } from './components/WeightTracker';
import { SettingsScreen } from './components/SettingsScreen';
import { getTodayString } from './utils/dateUtils';
import { auth, getAccessToken, logout, handleRedirectResult } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { StorageService } from './services/storage';
import { LoginScreen } from './components/LoginScreen';
import { LogOut, User as UserIcon } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('DIET');
  const [currentDate, setCurrentDate] = useState<string>(getTodayString);

  const [user, setUser] = useState(auth.currentUser);
  const [isInitializing, setIsInitializing] = useState(true);
  const [needsDriveAuth, setNeedsDriveAuth] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      window.location.reload();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  useEffect(() => {
    let active = true;
    const initAuth = async () => {
      // First, check and resolve any OAuth redirect result (saves Google token to localStorage)
      await handleRedirectResult();
      
      if (!active) return;

      const unsubscribe = onAuthStateChanged(auth, async (u) => {
        if (!active) return;
        setUser(u);
        setIsInitializing(false);
        if (u) {
          const token = await getAccessToken();
          if (!token) {
            // If no token, we still allow access, but Drive sync might fail gracefully
            setNeedsDriveAuth(false);
          } else {
            setNeedsDriveAuth(false);
            StorageService.syncFromCloud().catch(err => console.warn("Sync error (non-blocking):", err));
          }
        }
      });
      return unsubscribe;
    };

    const unsubPromise = initAuth();
    return () => {
      active = false;
      unsubPromise.then(unsub => unsub && unsub());
    };
  }, []);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-emerald-100 border-t-emerald-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] flex flex-col antialiased text-slate-800">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-emerald-950/5">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-800 text-white flex items-center justify-center font-black text-lg shadow-sm">
              FP
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">
                FitPocket
              </h1>
              <span className="text-[10px] font-bold text-emerald-800 tracking-widest uppercase">
                AI Intelligence
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2 p-1.5 pr-3 bg-slate-50 rounded-2xl border border-slate-200/50">
                {user.photoURL ? (
                  <img 
                    src={user.photoURL} 
                    alt={user.displayName || 'User'} 
                    className="w-8 h-8 rounded-xl object-cover shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700">
                    <UserIcon className="w-4 h-4" />
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-900 truncate max-w-[80px]">
                    {user.displayName || '使用者'}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="text-[9px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-0.5 transition"
                  >
                    <LogOut className="w-2.5 h-2.5" />
                    登出
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-4 sm:p-6 overflow-x-hidden">
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
    </div>
  );
}
