import React, { useState, useEffect } from 'react';
import { Navigation, TabType } from './components/Navigation';
import { DietTracker } from './components/DietTracker';
import { TrainingTracker } from './components/TrainingTracker';
import { WaterTracker } from './components/WaterTracker';
import { WeightTracker } from './components/WeightTracker';
import { SettingsScreen } from './components/SettingsScreen';
import { getTodayString } from './utils/dateUtils';
import { auth, getAccessToken, logout, handleRedirectResult, loginWithGoogle } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { StorageService, SyncStatus } from './services/storage';
import { LoginScreen } from './components/LoginScreen';
import { LogOut, User as UserIcon, AlertCircle, RefreshCw, CloudOff, CloudCheck, CloudLightning, DownloadCloud, HardDrive } from 'lucide-react';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useOnlineStatus } from './hooks/useOnlineStatus';

const SyncStatusIndicator = ({ status }: { status: SyncStatus }) => {
  const isOnline = useOnlineStatus();
  
  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold">
        <CloudLightning className="w-3 h-3" />
        離線模式
      </div>
    );
  }

  switch (status) {
    case 'synced':
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold">
          <CloudCheck className="w-3 h-3" />
          已同步
        </div>
      );
    case 'syncing':
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-sky-50 text-sky-600 rounded-full text-[10px] font-bold">
          <RefreshCw className="w-3 h-3 animate-spin" />
          同步中...
        </div>
      );
    case 'pending':
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold">
          <HardDrive className="w-3 h-3" />
          本機暫存
        </div>
      );
    case 'error':
      return (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-bold">
          <AlertCircle className="w-3 h-3" />
          同步錯誤
        </div>
      );
    default:
      return null;
  }
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('DIET');
  const [currentDate, setCurrentDate] = useState<string>(getTodayString);

  const [user, setUser] = useState(auth.currentUser);
  const [isInitializing, setIsInitializing] = useState(true);
  const [needsDriveAuth, setNeedsDriveAuth] = useState(false);
  const [isUpdatingCredentials, setIsUpdatingCredentials] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(StorageService.getCurrentSyncStatus());
  
  const { isInstallable, install } = usePWAInstall();

  const handleLogout = async () => {
    try {
      await logout();
      window.location.reload();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleRestoreAuth = async () => {
    try {
      setIsUpdatingCredentials(true);
      setNeedsDriveAuth(false);
      localStorage.setItem('fitpocket_redirect_pending', 'true');

      const result = await loginWithGoogle(false);
      if (result && result.isRedirecting) {
        return;
      }
      if (result && result.accessToken) {
        localStorage.removeItem('fitpocket_redirect_pending');
        localStorage.removeItem('fitpocket_auth_locking');
        sessionStorage.removeItem('fitpocket_auto_auth_attempted');
        setIsUpdatingCredentials(false);
        setNeedsDriveAuth(false);
        // Trigger a catch-up sync
        StorageService.syncFromCloud().catch(err => console.warn("Sync error:", err));
      } else {
        throw new Error("No token received");
      }
    } catch (err: any) {
      const errCode = err?.code || '';
      if (errCode === 'auth/popup-closed-by-user' || errCode === 'auth/cancelled-popup-request') {
        console.log("Restore auth cancelled by user.");
      } else {
        console.error("Restore auth error:", err);
      }
      localStorage.removeItem('fitpocket_redirect_pending');
      localStorage.removeItem('fitpocket_auth_locking');
      setIsUpdatingCredentials(false);
      setNeedsDriveAuth(true);
    } finally {
      localStorage.removeItem('fitpocket_auth_locking');
    }
  };

  // 防禦性監控：若自動更新卡住超過 10 秒，強制切換至手動更新介面
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    if (isUpdatingCredentials) {
      timeoutId = setTimeout(() => {
        console.warn("[App] Auth update took too long, forcing manual intervention.");
        setIsUpdatingCredentials(false);
        setNeedsDriveAuth(true);
        localStorage.removeItem('fitpocket_auth_locking');
      }, 10000); // 10 seconds
    }
    return () => clearTimeout(timeoutId);
  }, [isUpdatingCredentials]);

  useEffect(() => {
    let active = true;

    // Initialize storage (IndexedDB migration & loading)
    const initStorage = async () => {
      try {
        localStorage.removeItem('fitpocket_auth_locking');
        await StorageService.init();
        if (!active) return;

        // If returning from redirect, show updating status
        const isPendingRedirect = localStorage.getItem('fitpocket_redirect_pending') === 'true';
        if (isPendingRedirect) {
          setIsUpdatingCredentials(true);
        }

        // Check for redirect result immediately
        console.log("[App] Checking for redirect result...");
        const redirectedToken = await handleRedirectResult();
        console.log("[App] Redirect result found:", !!redirectedToken);
        if (redirectedToken) {
          localStorage.removeItem('fitpocket_redirect_pending');
          sessionStorage.removeItem('fitpocket_auto_auth_attempted');
          setNeedsDriveAuth(false);
          setIsUpdatingCredentials(false);
        } else if (isPendingRedirect) {
          console.warn("[App] Redirect pending but no token found, potential failure.");
        }
        
        // After storage is ready, handle auth state
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
          if (!active) return;
          setUser(u);
          
          try {
            if (u) {
              const token = await getAccessToken();
              if (token) {
                console.log("[App] Valid Drive token found, starting sync...");
                localStorage.removeItem('fitpocket_redirect_pending');
                sessionStorage.removeItem('fitpocket_auto_auth_attempted');
                setNeedsDriveAuth(false);
                setIsUpdatingCredentials(false);
                if (localStorage.getItem('fitpocket_sync_pending') === 'true') {
                  StorageService.saveToCloud().catch(err => console.warn("Catch-up sync error:", err));
                } else {
                  StorageService.syncFromCloud().catch(err => console.warn("Sync error (non-blocking):", err));
                }
              } else {
                // Token missing or expired
                console.log("[App] Token missing or expired, showing manual restore button.");
                localStorage.removeItem('fitpocket_redirect_pending');
                setIsUpdatingCredentials(false);
                setNeedsDriveAuth(true);
              }
            } else {
              localStorage.removeItem('fitpocket_redirect_pending');
              sessionStorage.removeItem('fitpocket_auto_auth_attempted');
              setIsUpdatingCredentials(false);
              setNeedsDriveAuth(false);
            }
          } catch (innerErr) {
            console.error("Auth helper error during init:", innerErr);
            localStorage.removeItem('fitpocket_redirect_pending');
            setIsUpdatingCredentials(false);
            setNeedsDriveAuth(true);
          } finally {
            if (active) {
              // Give it a tiny bit more time for any pending state updates to settle
              setTimeout(() => {
                if (active) setIsInitializing(false);
              }, 500);
            }
          }
        });

        return unsubscribe;
      } catch (err) {
        console.error("Storage initialization failed:", err);
        if (active) setIsInitializing(false);
        localStorage.removeItem('fitpocket_redirect_pending');
        setIsUpdatingCredentials(false);
        return () => {};
      }
    };

    let authUnsubscribe: (() => void) | undefined;
    initStorage().then(unsub => {
      authUnsubscribe = unsub;
    });

    // Request persistent storage
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persist().then(persistent => {
        if (persistent) {
          console.log("Storage will not be cleared except by explicit user action.");
        } else {
          console.log("Storage may be cleared by the browser under storage pressure.");
        }
      });
    }

    // Subscribe to sync status
    const stopSyncListen = StorageService.onSyncStatusChange((s) => {
      if (active) setSyncStatus(s);
    });

    return () => {
      active = false;
      if (authUnsubscribe) authUnsubscribe();
      stopSyncListen();
    };
  }, []);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-sky-100 border-t-sky-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={() => window.location.reload()} />;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col antialiased text-slate-800">
      {/* Updating Credentials Loading Modal */}
      {isUpdatingCredentials && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-sky-50 rounded-2xl flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-sky-600 animate-spin" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900">更新憑證中...</h3>
              <p className="text-xs text-slate-500 leading-relaxed px-4">
                正在驗證與更新您的 Google 雲端授權憑證，請稍候...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Drive Auth Expired Modal */}
      {!isUpdatingCredentials && needsDriveAuth && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-sky-50 rounded-2xl flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-sky-600" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900">同步需要您的授權</h3>
              <p className="text-xs text-slate-500 leading-relaxed px-4">
                為了確保您的飲食與運動數據能安全地備份至 Google Drive，請重新建立連線以進行同步。
              </p>
            </div>

            <div className="w-full pt-2">
              <button 
                onClick={handleRestoreAuth}
                className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-black rounded-2xl shadow-lg shadow-sky-200 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                登入 Google 帳號
              </button>
              
              <button 
                onClick={() => setNeedsDriveAuth(false)}
                className="w-full mt-2 py-2 text-slate-400 text-[10px] font-bold hover:text-slate-600 transition cursor-pointer"
              >
                暫時不同步
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top App Bar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-sky-950/5">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/favicon.jpg" 
              alt="FitPocket Logo" 
              className="w-10 h-10 rounded-2xl object-cover shadow-xs"
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">
                FitPocket
              </h1>
              <span className="text-[10px] font-bold text-sky-700 tracking-widest uppercase">
                AI Intelligence
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SyncStatusIndicator status={syncStatus} />
            
            {isInstallable && (
              <button
                onClick={install}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-black rounded-full shadow-sm transition active:scale-95"
              >
                <DownloadCloud className="w-3 h-3" />
                安裝 PWA
              </button>
            )}

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
                  <div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center text-sky-700">
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
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 pb-4 pt-2 sm:px-6 sm:pb-6 sm:pt-4 overflow-x-clip">
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
