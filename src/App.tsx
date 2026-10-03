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
import { LogOut, User as UserIcon, AlertCircle, RefreshCw, CloudCheck, CloudLightning, DownloadCloud, HardDrive, CheckCircle2, Zap, Flame } from 'lucide-react';
import { usePWAInstall } from './hooks/usePWAInstall';
import { useOnlineStatus } from './hooks/useOnlineStatus';

const SyncStatusIndicator = ({ status }: { status: SyncStatus }) => {
  const isOnline = useOnlineStatus();
  const isRealtime = StorageService.isRealTimeSyncEnabled();
  
  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold border border-slate-200/80 shadow-2xs">
        <CloudLightning className="w-3 h-3 text-amber-500 shrink-0" />
        <span>離線模式 (無網路)</span>
      </div>
    );
  }

  // When Real-Time Sync is DISABLED (User selected Daily / Offline local mode)
  if (!isRealtime) {
    if (status === 'syncing') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 text-sky-700 rounded-full text-[10px] font-bold border border-sky-200/80 shadow-2xs">
          <RefreshCw className="w-3 h-3 text-sky-600 animate-spin shrink-0" />
          <span>離線 (同步中...)</span>
        </div>
      );
    }
    if (status === 'pending') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold border border-amber-200/80 shadow-2xs">
          <HardDrive className="w-3 h-3 text-amber-600 shrink-0" />
          <span>離線暫存</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold border border-slate-200/80 shadow-2xs">
        <CloudLightning className="w-3 h-3 text-slate-500 shrink-0" />
        <span>離線模式</span>
      </div>
    );
  }

  // When Real-Time Sync is ENABLED
  switch (status) {
    case 'synced':
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[10px] font-bold border border-emerald-200/80 shadow-2xs">
          <Zap className="w-3 h-3 text-emerald-600 shrink-0" />
          <span>即時同步</span>
        </div>
      );
    case 'syncing':
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 text-sky-700 rounded-full text-[10px] font-bold border border-sky-200/80 shadow-2xs">
          <RefreshCw className="w-3 h-3 text-sky-600 animate-spin shrink-0" />
          <span>即時同步中...</span>
        </div>
      );
    case 'pending':
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-[10px] font-bold border border-amber-200/80 shadow-2xs">
          <HardDrive className="w-3 h-3 text-amber-600 shrink-0" />
          <span>即時待備份</span>
        </div>
      );
    case 'offline':
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold border border-slate-200/80 shadow-2xs">
          <CloudLightning className="w-3 h-3 text-slate-500 shrink-0" />
          <span>離線模式</span>
        </div>
      );
    case 'error':
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-50 text-rose-700 rounded-full text-[10px] font-bold border border-rose-200/80 shadow-2xs">
          <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
          <span>同步異常</span>
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
  const [showDailySyncModal, setShowDailySyncModal] = useState(false);
  const [showRealTimeSyncModal, setShowRealTimeSyncModal] = useState(false);
  const [isUpdatingCredentials, setIsUpdatingCredentials] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(StorageService.getCurrentSyncStatus());
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);
  const [logoSrc, setLogoSrc] = useState<string>(() => {
    return localStorage.getItem('fitpocket_cached_logo') || '/favicon.jpg';
  });

  useEffect(() => {
    if (!localStorage.getItem('fitpocket_cached_logo')) {
      fetch('/favicon.jpg')
        .then((res) => res.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = reader.result as string;
            if (base64data) {
              localStorage.setItem('fitpocket_cached_logo', base64data);
              setLogoSrc(base64data);
            }
          };
          reader.readAsDataURL(blob);
        })
        .catch(() => {});
    }
  }, []);
  
  const { isInstallable, install } = usePWAInstall();

  const handleLogout = async () => {
    try {
      await logout();
      window.location.reload();
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // Perform daily sync & credential update
  const handlePerformDailySync = async () => {
    try {
      setIsUpdatingCredentials(true);
      setShowDailySyncModal(false);
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

        // Perform full cloud sync and save
        const syncRes = await StorageService.syncFromCloud();
        await StorageService.saveToCloud(true);

        const today = getTodayString();
        localStorage.setItem('fitpocket_last_daily_sync_date', today);

        setSyncToastMessage(syncRes.message || '成功驗證憑證並完成今日雲端同步！今日已啟用零延遲離線模式。');
        setTimeout(() => setSyncToastMessage(null), 4000);
      } else {
        throw new Error("No token received");
      }
    } catch (err: any) {
      const errCode = err?.code || '';
      if (errCode === 'auth/popup-closed-by-user' || errCode === 'auth/cancelled-popup-request') {
        console.log("Daily sync cancelled by user.");
      } else {
        console.error("Daily sync auth error:", err);
      }
      localStorage.removeItem('fitpocket_redirect_pending');
      localStorage.removeItem('fitpocket_auth_locking');
      setIsUpdatingCredentials(false);
      setShowDailySyncModal(true);
    } finally {
      localStorage.removeItem('fitpocket_auth_locking');
    }
  };

  // Perform real-time sync credential verification
  const handlePerformRealTimeSyncAuth = async () => {
    try {
      setIsUpdatingCredentials(true);
      setShowRealTimeSyncModal(false);
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

        const syncRes = await StorageService.syncFromCloud();
        await StorageService.saveToCloud(true);

        const today = getTodayString();
        localStorage.setItem('fitpocket_last_daily_sync_date', today);

        setSyncToastMessage(syncRes.message || '⚡ 已成功驗證憑證！即時自動同步功能已就緒。');
        setTimeout(() => setSyncToastMessage(null), 4000);
      } else {
        throw new Error("No token received");
      }
    } catch (err: any) {
      console.error("Real-time sync auth error:", err);
      localStorage.removeItem('fitpocket_redirect_pending');
      localStorage.removeItem('fitpocket_auth_locking');
      setIsUpdatingCredentials(false);
      setShowRealTimeSyncModal(true);
    } finally {
      localStorage.removeItem('fitpocket_auth_locking');
    }
  };

  const handleSkipDailySync = () => {
    const today = getTodayString();
    localStorage.setItem('fitpocket_last_daily_sync_date', today);
    setShowDailySyncModal(false);
    setSyncToastMessage('已開啟今日離線模式，所有飲食與運動紀錄將全數儲存於本機。');
    setTimeout(() => setSyncToastMessage(null), 3000);
  };

  const handleSkipRealTimeSync = () => {
    StorageService.setRealTimeSyncEnabled(false);
    const today = getTodayString();
    localStorage.setItem('fitpocket_last_daily_sync_date', today);
    setShowRealTimeSyncModal(false);
    setSyncToastMessage('已切換為離線暫存模式，所有紀錄將先儲存於本機。');
    setTimeout(() => setSyncToastMessage(null), 3000);
  };

  const handleRestoreAuth = async () => {
    await handlePerformDailySync();
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
          setShowDailySyncModal(false);
          setIsUpdatingCredentials(false);
          const today = getTodayString();
          localStorage.setItem('fitpocket_last_daily_sync_date', today);
          StorageService.syncFromCloud().then(() => StorageService.saveToCloud(true)).catch(err => console.warn("Sync error:", err));
          setSyncToastMessage('已成功更新憑證並完成今日雲端同步！今日將保持極速離線模式。');
          setTimeout(() => setSyncToastMessage(null), 4000);
        } else if (isPendingRedirect) {
          console.warn("[App] Redirect pending but no token found, potential failure.");
        }
        
        // After storage is ready, handle auth state
        const unsubscribe = onAuthStateChanged(auth, async (u) => {
          if (!active) return;
          setUser(u);
          
          try {
            if (u) {
              if (u.email) {
                localStorage.setItem('fitpocket_last_user_email', u.email);
              }
              const today = getTodayString();
              const lastDailySync = localStorage.getItem('fitpocket_last_daily_sync_date');
              const isFirstOpenToday = lastDailySync !== today;
              const isRealtimeSync = StorageService.isRealTimeSyncEnabled();
              const hasToken = !!(await getAccessToken());

              if (!redirectedToken) {
                if (hasToken) {
                  // Credential verified! Suppress all modals on launch
                  console.log("[App] Valid credential confirmed! Skipping auth dialog modal.");
                  setShowRealTimeSyncModal(false);
                  setShowDailySyncModal(false);
                  setNeedsDriveAuth(false);
                  setIsUpdatingCredentials(false);

                  // Update daily sync date and execute background sync if needed
                  if (isFirstOpenToday) {
                    localStorage.setItem('fitpocket_last_daily_sync_date', today);
                    StorageService.syncFromCloud().catch(err => console.warn("Background sync error:", err));
                  }
                } else {
                  // Credential missing or expired -> Prompt user dialog
                  if (isRealtimeSync) {
                    console.log("[App] Real-Time Sync active but no valid credential token found. Prompting modal.");
                    setShowRealTimeSyncModal(true);
                    setShowDailySyncModal(false);
                    setNeedsDriveAuth(false);
                    setIsUpdatingCredentials(false);
                  } else if (isFirstOpenToday) {
                    console.log("[App] Daily Sync active and first open today with no token. Prompting modal.");
                    setShowDailySyncModal(true);
                    setShowRealTimeSyncModal(false);
                    setNeedsDriveAuth(false);
                    setIsUpdatingCredentials(false);
                  } else {
                    setShowDailySyncModal(false);
                    setShowRealTimeSyncModal(false);
                    setNeedsDriveAuth(false);
                    setIsUpdatingCredentials(false);
                  }
                }
              } else {
                setShowDailySyncModal(false);
                setShowRealTimeSyncModal(false);
                setNeedsDriveAuth(false);
                setIsUpdatingCredentials(false);
              }
            } else {
              localStorage.removeItem('fitpocket_redirect_pending');
              sessionStorage.removeItem('fitpocket_auto_auth_attempted');
              setIsUpdatingCredentials(false);
              setNeedsDriveAuth(false);
              setShowDailySyncModal(false);
              setShowRealTimeSyncModal(false);
            }
          } catch (innerErr) {
            console.error("Auth helper error during init:", innerErr);
            localStorage.removeItem('fitpocket_redirect_pending');
            setIsUpdatingCredentials(false);
          } finally {
            if (active) {
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

    // Subscribe to sync status & data changes
    const stopSyncListen = StorageService.onSyncStatusChange((s) => {
      if (active) setSyncStatus(s);
    });

    const stopDataListen = StorageService.subscribeDataChange(() => {
      if (active) setSyncStatus(StorageService.getCurrentSyncStatus());
    });

    return () => {
      active = false;
      if (authUnsubscribe) authUnsubscribe();
      stopSyncListen();
      stopDataListen();
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
    <div className="h-full h-[100dvh] bg-[#F8FAFC] flex flex-col antialiased text-slate-800 overflow-hidden">
      {/* Toast Feedback Notification */}
      {syncToastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] bg-slate-900/90 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300 border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{syncToastMessage}</span>
        </div>
      )}

      {/* Updating Credentials Loading Modal */}
      {isUpdatingCredentials && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-sky-50 rounded-2xl flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-sky-600 animate-spin" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-black text-slate-900">更新憑證與同步中...</h3>
              <p className="text-xs text-slate-500 leading-relaxed px-4">
                正在驗證 Google 雲端憑證並合併今日資料，請稍候...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Daily First Open - Credentials Update & Sync Modal */}
      {!isUpdatingCredentials && showDailySyncModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner relative">
              <RefreshCw className="w-8 h-8 text-emerald-600" />
              <CloudCheck className="w-5 h-5 text-emerald-500 absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border border-emerald-100 shadow-xs" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100/80 text-emerald-800 rounded-full text-[10px] font-black tracking-wider uppercase">
                每日 1 次 · 雲端同步備份
              </div>
              <h3 className="text-lg font-black text-slate-900">每日憑證更新與雲端同步</h3>
              <p className="text-xs text-slate-500 leading-relaxed px-2">
                這是您今天首次開啟 App。請驗證 Google 憑證並進行今日雲端同步與資料合併。完成後今日將自動開啟<span className="font-bold text-emerald-700">極速離線模式</span>！
              </p>
            </div>

            {/* Incognito & Data Clear Notice */}
            <div className="w-full p-3 bg-amber-50/90 border border-amber-200/90 rounded-2xl text-left text-[11px] text-amber-900 leading-relaxed space-y-1">
              <div className="font-extrabold text-amber-800 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>離線模式溫馨提醒</span>
              </div>
              <p className="text-amber-800/90">
                今日為離線模式，紀錄將即時儲存於本機。若您今日使用<span className="font-bold text-amber-950 underline decoration-amber-400">無痕視窗</span>或預計<span className="font-bold text-amber-950 underline decoration-amber-400">清除瀏覽器紀錄</span>前，請記得至設定頁點擊手動同步，避免資料遺失喔！
              </p>
            </div>

            <div className="w-full space-y-2 pt-2">
              <button 
                onClick={handlePerformDailySync}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-200 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                更新憑證並同步今日資料
              </button>

              <button 
                onClick={handleSkipDailySync}
                className="w-full py-2.5 text-slate-400 hover:text-slate-600 font-bold text-xs transition cursor-pointer"
              >
                ⚡ 暫時跳過，今日保持離線
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Sync Launch / Credential Verification Modal */}
      {!isUpdatingCredentials && !showDailySyncModal && showRealTimeSyncModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center shadow-inner relative">
              <Zap className="w-8 h-8 text-sky-600 animate-pulse" />
              <CloudCheck className="w-5 h-5 text-sky-500 absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border border-sky-100 shadow-xs" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-sky-100/90 text-sky-800 rounded-full text-[10px] font-black tracking-wider uppercase">
                ⚡ 即時自動同步 · 憑證連線
              </div>
              <h3 className="text-lg font-black text-slate-900">即時自動同步連線確認</h3>
              <p className="text-xs text-slate-500 leading-relaxed px-2">
                您目前已啟用<span className="font-bold text-sky-700">即時自動同步</span>模式。請驗證 Google 授權憑證，確保紀錄在異動時能自動即時備份至雲端。
              </p>
            </div>

            <div className="w-full p-3 bg-sky-50/80 border border-sky-100 rounded-2xl text-left text-[11px] text-sky-900 leading-relaxed space-y-1">
              <div className="font-extrabold text-sky-800 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>即時自動同步運作說明</span>
              </div>
              <p className="text-sky-800/90">
                每筆飲食、運動、水分與體重紀錄，將在您新增或修改時即時連線更新至您的 Google Drive，維持多裝置數據一致。
              </p>
            </div>

            <div className="w-full space-y-2 pt-2">
              <button 
                onClick={handlePerformRealTimeSyncAuth}
                className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-sky-200 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-white" />
                驗證憑證並啟動即時同步
              </button>

              <button 
                onClick={handleSkipRealTimeSync}
                className="w-full py-2.5 text-slate-400 hover:text-slate-600 font-bold text-xs transition cursor-pointer"
              >
                暫時切換為離線暫存模式
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drive Auth Expired Fallback Modal */}
      {!isUpdatingCredentials && !showDailySyncModal && needsDriveAuth && (
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
              {(typeof window !== 'undefined' && window.self !== window.top) && (
                <div className="mx-4 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <p className="text-[10px] font-black text-amber-700 flex items-center justify-center gap-1.5 uppercase tracking-wider">
                    <AlertCircle className="w-3 h-3" /> 預覽環境提示
                  </p>
                  <p className="text-[10px] text-amber-600 font-bold mt-1">
                    由於預覽視窗限制，請點擊右上方「在新分頁中開啟 (Open in new tab)」後再進行登入。
                  </p>
                </div>
              )}
            </div>

            <div className="w-full pt-2">
              <button 
                onClick={handleRestoreAuth}
                className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-sky-200 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
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
      <header className="shrink-0 z-40 bg-white/80 backdrop-blur-xl border-b border-sky-950/5">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={logoSrc} 
              alt="NutraiFit Logo" 
              className="w-10 h-10 rounded-2xl object-cover shadow-xs"
              onError={() => {
                setLogoSrc('/favicon.jpg');
                localStorage.removeItem('fitpocket_cached_logo');
              }}
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none">
                NutraiFit
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
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 pb-20 pt-2 sm:px-6 sm:pb-24 sm:pt-4 overflow-y-auto overscroll-contain">
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
