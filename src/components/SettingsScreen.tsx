import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getTodayString, getNextGoogleApiResetInfo } from '../utils/dateUtils';
import { generateFullAppExportHtml } from '../utils/htmlExporter';
import {
  Settings,
  Calculator,
  Flame,
  Utensils,
  Database,
  Download,
  Upload,
  Key,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  ChevronRight,
  FileText,
  User,
  Cloud,
  RefreshCw,
  Search,
  X,
  ChevronDown,
  Activity,
  Cpu,
  Zap,
  RotateCcw,
  Clock,
  Barcode,
  Dumbbell,
  SlidersHorizontal,
  ShieldAlert,
  Gauge,
  Image as ImageIcon,
  Crown,
  ShieldCheck,
  UserCheck,
  UserX,
  Shield,
  Lock,
  Unlock,
  Send,
  Users,
  CheckCircle2,
  UserPlus,
  Filter,
  Camera,
  Loader2,
  BarChart3,
} from 'lucide-react';
import {
  CustomFood,
  UserProfile,
  CarbCycleType,
  NutritionGoalPreset,
  ApiUsageStats,
  AiKeySource,
  AiWhitelistUser,
  DeveloperQuotaInfo,
} from '../types';
import { StorageService } from '../services/storage';
import { CloudFoodService } from '../services/cloudFoodService';
import { CARB_CYCLE_INFO, getCarbCycleBadgeStyle } from '../data/defaults';
import { GoalSettingModal } from './GoalSettingModal';
import { CustomFoodModal } from './CustomFoodModal';
import { ExportHtmlModal } from './ExportHtmlModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { AiCameraModal } from './AiCameraModal';
import { MacroCalorieVerifier } from './MacroCalorieVerifier';
import { optimizeImageForAi } from '../utils/imageOptimizer';
import { checkAiKeyOrWarn, getAiRequestParams } from '../utils/aiHelper';
import { auth, loginWithGoogle, logout, testFirebaseConnection, getAccessToken } from '../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { motion } from 'motion/react';

export const SettingsScreen: React.FC = () => {
  const [user, setUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [hasDriveToken, setHasDriveToken] = useState<boolean>(
    !!localStorage.getItem('fitpocket_google_access_token')
  );

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setHasDriveToken(!!localStorage.getItem('fitpocket_google_access_token'));
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const res = await loginWithGoogle(true);
      if (res?.accessToken || res?.user) {
        setHasDriveToken(true);
        flashMessage('已成功登入並開始同步雲端資料！');
      }
    } catch (err: any) {
      console.warn('Login notice:', err);
      const msg = err?.message || '登入遭遇問題，請確認瀏覽器未封鎖彈跳視窗或在新分頁中開啟。';
      flashMessage(msg);
    }
  };

  const handleRestoreAuth = async () => {
    try {
      flashMessage('正在與 Google 帳號建立授權連線...');
      const result = await loginWithGoogle(false);
      if (result.accessToken || result.user) {
        setHasDriveToken(true);
        flashMessage('成功恢復 Google Drive 雲端同步授權！');
      }
    } catch (err: any) {
      console.warn('Restore auth notice:', err);
      const msg = err?.message || '修復失敗，請確認是否允許彈跳視窗或在新分頁中開啟應用。';
      flashMessage(msg);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setHasDriveToken(false);
      flashMessage('已登出雲端帳號。');
    } catch (err) {
      console.error(err);
    }
  };

  const [userProfile, setUserProfile] = useState<UserProfile>(
    StorageService.getUserProfile()
  );
  const [customFoods, setCustomFoods] = useState<CustomFood[]>(
    StorageService.getCustomFoods()
  );
  const [geminiKey, setGeminiKey] = useState<string>(
    StorageService.getGeminiApiKey()
  );
  const [aiModel, setAiModel] = useState<string>(
    StorageService.getSelectedAiModel()
  );
  const [aiKeySource, setAiKeySource] = useState<AiKeySource>(() =>
    StorageService.getAiKeySource()
  );
  const [devQuota, setDevQuota] = useState<DeveloperQuotaInfo | null>(null);
  const [loadingDevQuota, setLoadingDevQuota] = useState(false);
  const [requestingAccess, setRequestingAccess] = useState(false);

  // Admin Management State (for Kevin10611@gmail.com)
  const isAdmin = (user?.email || '').toLowerCase() === 'kevin10611@gmail.com';
  const [adminWhitelist, setAdminWhitelist] = useState<AiWhitelistUser[]>([]);
  const [loadingAdminWhitelist, setLoadingAdminWhitelist] = useState(false);
  const [adminActionLoadingKey, setAdminActionLoadingKey] = useState<string | null>(null);

  // Shared Gemini Key Status
  const [sharedKeyStatus, setSharedKeyStatus] = useState<{
    hasKey: boolean;
    firestoreSynced: boolean;
    source: string;
    maskedKey: string;
    lastTestedModel?: string;
  } | null>(null);

  const [testingSharedKey, setTestingSharedKey] = useState(false);
  const [adminTestResult, setAdminTestResult] = useState<{
    ok: boolean;
    message: string;
    latencyMs?: number;
    modelUsed?: string;
  } | null>(null);

  const fetchSharedKeyStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/shared-gemini-key-status');
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setSharedKeyStatus({
            hasKey: data.hasKey,
            firestoreSynced: data.firestoreSynced ?? (data.source === 'firestore'),
            source: data.source,
            maskedKey: data.maskedKey,
          });
        }
      }
    } catch (e) {
      console.error('Failed to fetch shared key status:', e);
    }
  }, []);

  const handleTestSharedKey = async () => {
    if (!user?.email || user.email.toLowerCase() !== 'kevin10611@gmail.com') return;
    setTestingSharedKey(true);
    setAdminTestResult(null);
    try {
      const res = await fetch('/api/admin/test-shared-gemini-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: user.email }),
      });
      const data = await res.json();
      setAdminTestResult({
        ok: data.ok,
        message: data.ok ? data.message : (data.error || '連線測試失敗'),
        latencyMs: data.latencyMs,
        modelUsed: data.modelUsed,
      });
      if (data.ok) {
        fetchSharedKeyStatus();
      }
    } catch (err: any) {
      setAdminTestResult({
        ok: false,
        message: `連線異常：${err.message}`,
      });
    } finally {
      setTestingSharedKey(false);
    }
  };
  const [adminSearch, setAdminSearch] = useState('');
  const [adminFilter, setAdminFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [showAddWhitelistModal, setShowAddWhitelistModal] = useState(false);
  const [showEditWhitelistModal, setShowEditWhitelistModal] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [selectedWhitelistUser, setSelectedWhitelistUser] = useState<AiWhitelistUser | null>(null);

  // Daily Usage History
  const [dailyHistory, setDailyHistory] = useState<{ date: string; calls: number; tokens: number }[]>([]);
  const [loadingDailyHistory, setLoadingDailyHistory] = useState(false);
  const [clearingStats, setClearingStats] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Form states for Add / Edit Whitelist User
  const [formEmail, setFormEmail] = useState('');
  const [formDisplayName, setFormDisplayName] = useState('');
  const [formDailyLimit, setFormDailyLimit] = useState(20);
  const [formStatus, setFormStatus] = useState<'approved' | 'pending' | 'rejected'>('approved');
  const [formNotes, setFormNotes] = useState('');
  const [formResetToday, setFormResetToday] = useState(false);
  const [submittingAdminForm, setSubmittingAdminForm] = useState(false);

  const [apiUsage, setApiUsage] = useState<ApiUsageStats>(() =>
    StorageService.getApiUsageStats()
  );
  const [showResetUsageConfirm, setShowResetUsageConfirm] = useState(false);
  const [cloudFoodCount, setCloudFoodCount] = useState<number | null>(null);

  useEffect(() => {
    CloudFoodService.getCloudFoodsCount().then((count) => setCloudFoodCount(count));
  }, []);

  // Admin Database Food Management States
  const [showDatabaseFoodModal, setShowDatabaseFoodModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<'cloud_foods' | 'family_foods' | 'open_foods'>('cloud_foods');
  const [adminDatabaseFoods, setAdminDatabaseFoods] = useState<any[]>([]);
  const [loadingDatabaseFoods, setLoadingDatabaseFoods] = useState(false);
  const [adminFoodSearch, setAdminFoodSearch] = useState('');
  
  // For editing or adding a food
  const [showEditAdminFoodModal, setShowEditAdminFoodModal] = useState(false);
  const [editingAdminFood, setEditingAdminFood] = useState<any | null>(null);

  // Editing form states
  const [editFoodName, setEditFoodName] = useState('');
  const [editFoodBrand, setEditFoodBrand] = useState('');
  const [editFoodCalories, setEditFoodCalories] = useState(0);
  const [editFoodCarbs, setEditFoodCarbs] = useState(0);
  const [editFoodProtein, setEditFoodProtein] = useState(0);
  const [editFoodFat, setEditFoodFat] = useState(0);
  const [editFoodSugars, setEditFoodSugars] = useState(0);
  const [editFoodFiber, setEditFoodFiber] = useState(0);
  const [editFoodSodium, setEditFoodSodium] = useState(0);
  const [editFoodPotassium, setEditFoodPotassium] = useState(0);
  const [editFoodServingAmount, setEditFoodServingAmount] = useState(100);
  const [editFoodServingUnit, setEditFoodServingUnit] = useState('g');
  const [editFoodImageUrl, setEditFoodImageUrl] = useState('');
  const [editFoodBarcode, setEditFoodBarcode] = useState('');

  const [showBarcodeScannerForAdmin, setShowBarcodeScannerForAdmin] = useState(false);
  const [showAiCameraModalForAdmin, setShowAiCameraModalForAdmin] = useState(false);
  const [isAiAnalyzingAdminFood, setIsAiAnalyzingAdminFood] = useState(false);
  const [aiAnalysisAdminStatus, setAiAnalysisAdminStatus] = useState('');
  const [aiAnalysisAdminProgress, setAiAnalysisAdminProgress] = useState(0);
  const aiPhotoInputRef = useRef<HTMLInputElement | null>(null);

  const handleAdminAiImageCaptured = async (base64: string, mimeType: string) => {
    if (!checkAiKeyOrWarn()) return;

    setIsAiAnalyzingAdminFood(true);
    setAiAnalysisAdminProgress(30);
    setAiAnalysisAdminStatus('正在優化圖片以加快 AI 辨識...');

    try {
      const optimizedBase64 = await optimizeImageForAi(base64, 768, 768, 0.7);
      const aiParams = getAiRequestParams();
      const model = StorageService.getSelectedAiModel();

      setAiAnalysisAdminProgress(50);
      setAiAnalysisAdminStatus(`[${model}] AI 智慧辨識營養標示與食物中...`);

      const res = await fetch('/api/ai/estimate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: optimizedBase64,
          mimeType: mimeType || 'image/jpeg',
          customApiKey: aiParams.customApiKey,
          apiKeySource: aiParams.apiKeySource,
          userEmail: aiParams.userEmail,
          userUid: aiParams.userUid,
          model,
        }),
      });

      setAiAnalysisAdminProgress(85);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'AI 辨識失敗');
      }

      const result = await res.json();
      if (result._usage) {
        StorageService.recordApiUsage(result._usage);
      }

      const defaultAmount = Number(result.defaultServingAmount) || 100;
      const ratio = defaultAmount / 100;

      setEditFoodName(result.name || '');
      if (result.brand && result.brand !== 'AI辨識') {
        setEditFoodBrand(result.brand);
      }
      if (result.barcode) {
        setEditFoodBarcode(result.barcode);
      }
      if (result.imageUrl) {
        setEditFoodImageUrl(result.imageUrl);
      }
      setEditFoodServingAmount(defaultAmount);
      setEditFoodServingUnit(result.servingUnit || 'g');
      setEditFoodCalories(Math.round((Number(result.caloriesPer100g) || 0) * ratio * 10) / 10);
      setEditFoodCarbs(Math.round((Number(result.carbsPer100g) || 0) * ratio * 10) / 10);
      setEditFoodProtein(Math.round((Number(result.proteinPer100g) || 0) * ratio * 10) / 10);
      setEditFoodFat(Math.round((Number(result.fatPer100g) || 0) * ratio * 10) / 10);
      setEditFoodSugars(Math.round((Number(result.sugarsPer100g) || 0) * ratio * 10) / 10);
      setEditFoodFiber(Math.round((Number(result.fiberPer100g) || 0) * ratio * 10) / 10);
      setEditFoodSodium(Math.round((Number(result.sodiumPer100g) || 0) * ratio * 10) / 10);
      setEditFoodPotassium(Math.round((Number(result.potassiumPer100g) || 0) * ratio * 10) / 10);

      flashMessage('✨ AI 智慧辨識成功！已自動填入營養與規格資料');
    } catch (err: any) {
      console.error('Admin AI image analysis error:', err);
      flashMessage(`AI 辨識錯誤：${err.message || err}`);
    } finally {
      setIsAiAnalyzingAdminFood(false);
      setAiAnalysisAdminProgress(0);
      setAiAnalysisAdminStatus('');
    }
  };

  const fetchAdminDatabaseFoods = async (collectionName: 'cloud_foods' | 'family_foods' | 'open_foods') => {
    setLoadingDatabaseFoods(true);
    try {
      const { collection, getDocs, query, limit } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const colRef = collection(db, collectionName);
      const q = query(colRef, limit(300));
      const querySnap = await getDocs(q);
      const list: any[] = [];
      querySnap.forEach((docSnap) => {
        list.push({
          id: docSnap.id,
          ...docSnap.data()
        });
      });
      list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      setAdminDatabaseFoods(list);
    } catch (err: any) {
      console.error('Failed to fetch database foods:', err);
      flashMessage(`載入資料庫失敗：${err.message || err}`);
    } finally {
      setLoadingDatabaseFoods(false);
    }
  };

  const handleSaveAdminFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFoodName.trim()) {
      flashMessage('請輸入食品名稱');
      return;
    }
    
    try {
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      
      let docId = editingAdminFood?.id;
      if (!docId) {
        const brand = editFoodBrand.trim();
        const name = editFoodName.trim();
        const unit = editFoodServingUnit.trim();
        const barcode = editFoodBarcode.trim();
        
        if (collectionNameForHashing(selectedCollection) === 'cloud_foods') {
          const { generateDeterministicCloudId } = await import('../services/cloudFoodService');
          docId = generateDeterministicCloudId(brand, name, unit);
        } else if (collectionNameForHashing(selectedCollection) === 'open_foods') {
          const { generateDeterministicOpenFoodId } = await import('../services/openFoodService');
          docId = generateDeterministicOpenFoodId(brand, name, unit, barcode);
        } else {
          docId = `family_${Date.now()}`;
        }
      }
      
      const docRef = doc(db, selectedCollection, docId!);
      
      const dataToSave = {
        id: docId,
        name: editFoodName.trim(),
        brand: editFoodBrand.trim() || (selectedCollection === 'family_foods' ? '全家' : selectedCollection === 'open_foods' ? 'Open Food Facts' : '自訂'),
        calories: Number(editFoodCalories) || 0,
        carbs: Number(editFoodCarbs) || 0,
        protein: Number(editFoodProtein) || 0,
        fat: Number(editFoodFat) || 0,
        sugars: Number(editFoodSugars) || 0,
        fiber: Number(editFoodFiber) || 0,
        sodium: Number(editFoodSodium) || 0,
        potassium: Number(editFoodPotassium) || 0,
        servingAmount: Number(editFoodServingAmount) || 100,
        servingUnit: editFoodServingUnit.trim() || 'g',
        imageUrl: editFoodImageUrl.trim(),
        barcode: editFoodBarcode.trim(),
        updatedAt: Date.now(),
      };
      
      if (!editingAdminFood) {
        (dataToSave as any).createdAt = Date.now();
      } else {
        (dataToSave as any).createdAt = editingAdminFood.createdAt || Date.now();
      }
      
      await setDoc(docRef, dataToSave, { merge: true });
      flashMessage(editingAdminFood ? '食品修改成功！' : '食品新增成功！');
      setShowEditAdminFoodModal(false);
      setEditingAdminFood(null);
      
      fetchAdminDatabaseFoods(selectedCollection);
    } catch (err: any) {
      console.error('Error saving admin food:', err);
      flashMessage(`儲存失敗：${err.message || err}`);
    }
  };

  const collectionNameForHashing = (col: string): string => col;

  const handleDeleteAdminFood = async (foodId: string) => {
    if (!window.confirm('確定要永久刪除此食品項目嗎？這將無法復原！')) {
      return;
    }
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      const docRef = doc(db, selectedCollection, foodId);
      await deleteDoc(docRef);
      flashMessage('食品已成功刪除！');
      fetchAdminDatabaseFoods(selectedCollection);
    } catch (err: any) {
      console.error('Error deleting admin food:', err);
      flashMessage(`刪除失敗：${err.message || err}`);
    }
  };

  useEffect(() => {
    const unsubscribe = StorageService.subscribeApiUsage((stats) => {
      setApiUsage(stats);
    });
    return () => unsubscribe();
  }, []);

  // Google API Quota reset countdown and auto-check
  const [resetInfo, setResetInfo] = useState(() => getNextGoogleApiResetInfo());
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [callsLimitInput, setCallsLimitInput] = useState('');
  const [tokensLimitInput, setTokensLimitInput] = useState('');
  const [isCallsLimitEnabled, setIsCallsLimitEnabled] = useState(true);
  const [isTokensLimitEnabled, setIsTokensLimitEnabled] = useState(true);

  useEffect(() => {
    const updateCountdown = () => {
      const info = getNextGoogleApiResetInfo();
      setResetInfo(info);
      StorageService.checkDailyQuotaReset();
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenLimitModal = () => {
    setIsCallsLimitEnabled(apiUsage.dailyCallsLimit !== null);
    setCallsLimitInput(apiUsage.dailyCallsLimit !== null ? String(apiUsage.dailyCallsLimit) : '1500');
    setIsTokensLimitEnabled(apiUsage.dailyTokensLimit !== null);
    setTokensLimitInput(apiUsage.dailyTokensLimit !== null ? String(apiUsage.dailyTokensLimit) : '1000000');
    setShowLimitModal(true);
  };

  const handleSaveLimits = () => {
    const parsedCalls = isCallsLimitEnabled ? (parseInt(callsLimitInput, 10) || 1500) : null;
    const parsedTokens = isTokensLimitEnabled ? (parseInt(tokensLimitInput, 10) || 1000000) : null;
    StorageService.setApiUsageLimits({
      dailyCallsLimit: parsedCalls,
      dailyTokensLimit: parsedTokens,
    });
    setShowLimitModal(false);
    flashMessage('API 每日呼叫次數與 Token 上限已更新！');
  };

  // Modals
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [presets, setPresets] = useState<Record<CarbCycleType, NutritionGoalPreset>>(() => StorageService.getPresets());
  const [showCustomFoodModal, setShowCustomFoodModal] = useState(false);
  const [showCustomFoodsListModal, setShowCustomFoodsListModal] = useState(false);
  const [showExportHtmlModal, setShowExportHtmlModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showAdminSyncModal, setShowAdminSyncModal] = useState(false);
  const [adminCustomKeyInput, setAdminCustomKeyInput] = useState('');
  const [adminSyncTab, setAdminSyncTab] = useState<'env' | 'custom'>('env');
  const [customFoodsSearchQuery, setCustomFoodsSearchQuery] = useState('');
  const [editingCustomFood, setEditingCustomFood] = useState<CustomFood | undefined>(
    undefined
  );
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Save feedback state
  const [savedMessage, setSavedMessage] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState<'none' | 'saved' | 'deleted'>('none');

  const flashMessage = (msg: string) => {
    setSavedMessage(msg);
    setTimeout(() => setSavedMessage(''), 3000);
  };

  // Fetch developer quota for current user
  const fetchDevQuota = useCallback(async () => {
    if (!user?.email) {
      setDevQuota(null);
      return;
    }
    setLoadingDevQuota(true);
    try {
      const res = await fetch(`/api/ai/developer-quota?userEmail=${encodeURIComponent(user.email)}`);
      const data = await res.json();
      // Server returns direct data if found, or status: 'not_requested'
      if (data && !data.error) {
        setDevQuota({
          dailyLimit: data.dailyLimit,
          todayUsage: data.todayUsage,
          remaining: data.remaining,
          totalTokensUsed: data.totalTokensUsed,
          quotaCycleDate: data.quotaCycleDate,
          status: data.status,
          isAdmin: data.isAdmin,
        });
        const currentCustomKey = StorageService.getGeminiApiKey();
        if (data.status === 'approved' && (!currentCustomKey || !currentCustomKey.trim())) {
          StorageService.saveAiKeySource('developer');
        }
      }
    } catch (err) {
      console.warn('Failed to fetch developer quota:', err);
    } finally {
      setLoadingDevQuota(false);
    }
  }, [user?.email]);

  // Fetch Admin Whitelist users
  const fetchAdminWhitelist = useCallback(async () => {
    if (!isAdmin || !user?.email) return;
    setLoadingAdminWhitelist(true);
    try {
      const res = await fetch(`/api/admin/whitelist?adminEmail=${encodeURIComponent(user.email)}`);
      const data = await res.json();
      // Server returns { users: [...] } directly
      if (data && Array.isArray(data.users)) {
        setAdminWhitelist(data.users);
      } else if (data.error) {
        flashMessage(`載入白名單失敗：${data.error}`);
      }
    } catch (err: any) {
      console.warn('Failed to fetch admin whitelist:', err);
      flashMessage('無法載入白名單清單，請稍後重試');
    } finally {
      setLoadingAdminWhitelist(false);
    }
  }, [isAdmin, user?.email]);

  // Fetch Daily Usage History
  const fetchDailyHistory = useCallback(async () => {
    if (!user?.email) return;
    setLoadingDailyHistory(true);
    try {
      const res = await fetch(`/api/ai/daily-history?userEmail=${encodeURIComponent(user.email)}`);
      const data = await res.json();
      if (data && Array.isArray(data.history)) {
        setDailyHistory(data.history);
      }
    } catch (err) {
      console.warn('Failed to fetch daily history:', err);
    } finally {
      setLoadingDailyHistory(false);
    }
  }, [user?.email]);

  useEffect(() => {
    fetchDevQuota();
    fetchDailyHistory();
  }, [fetchDevQuota, fetchDailyHistory]);

  useEffect(() => {
    if (isAdmin) {
      fetchAdminWhitelist();
      fetchSharedKeyStatus();
    }
  }, [isAdmin, fetchAdminWhitelist, fetchSharedKeyStatus]);

  // User Request Access
  const handleRequestAccess = async () => {
    console.log('handleRequestAccess triggered', { user: user?.email, uid: user?.uid });
    if (!user?.email) {
      flashMessage('請先登入 Google 帳號後再送出申請！');
      return;
    }
    setRequestingAccess(true);
    try {
      console.log('Sending POST to /api/ai/request-access');
      const res = await fetch('/api/ai/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          uid: user.uid,
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
        }),
      });
      const data = await res.json();
      console.log('Received response from /api/ai/request-access', data);
      if (data.success || data.ok || (data.user && !data.error)) {
        flashMessage(data.message || '申請已送出！請靜候開發者審核。');
        await fetchDevQuota();
        if (isAdmin) await fetchAdminWhitelist();
      } else {
        flashMessage(`申請失敗：${data.error || '未知原因'}`);
      }
    } catch (err: any) {
      console.error('Error in handleRequestAccess:', err);
      flashMessage(`申請過程發生錯誤：${err.message}`);
    } finally {
      setRequestingAccess(false);
    }
  };

  // Clear all usage stats and history
  const handleClearUsageStats = async () => {
    if (!user?.email) return;

    setClearingStats(true);
    try {
      const res = await fetch('/api/ai/clear-usage-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: user.email }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        flashMessage('✨ 全站統計數據與歷史紀錄已成功清除！');
        setShowClearConfirm(false);
        await fetchDevQuota();
        await fetchAdminWhitelist();
        await fetchDailyHistory();
      } else {
        flashMessage(`清除失敗：${data.error || '未知錯誤'}`);
      }
    } catch (err: any) {
      console.error('Clear usage stats error:', err);
      flashMessage(`清除統計時發生錯誤：${err.message}`);
    } finally {
      setClearingStats(false);
    }
  };

  // Switch AI Key Source
  const handleAiKeySourceChange = (source: AiKeySource) => {
    setAiKeySource(source);
    StorageService.saveAiKeySource(source);
    flashMessage(
      source === 'developer'
        ? '已切換為「開發者共享金鑰 (白名單審核制)」'
        : '已切換為「個人自備 API 金鑰」'
    );
  };

  // Admin Actions
  const handleAdminApprove = async (targetEmail: string, dailyLimit = 20) => {
    if (!user?.email) return;
    setAdminActionLoadingKey(`approve_${targetEmail}`);
    try {
      const res = await fetch('/api/admin/whitelist/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: user.email,
          targetEmail,
          status: 'approved',
          dailyLimit,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.ok || data.success)) {
        flashMessage(`已核准 ${targetEmail} 的 AI 使用權限 (每日 ${dailyLimit} 次)！`);
        await fetchAdminWhitelist();
        if (user.email.toLowerCase() === targetEmail.toLowerCase()) {
          await fetchDevQuota();
        }
      } else {
        flashMessage(`操作失敗：${data.error || '無法完成核准'}`);
      }
    } catch (err: any) {
      flashMessage(`操作發生錯誤：${err.message}`);
    } finally {
      setAdminActionLoadingKey(null);
    }
  };

  const handleAdminReject = async (targetEmail: string) => {
    if (!user?.email) return;
    setAdminActionLoadingKey(`reject_${targetEmail}`);
    try {
      const res = await fetch('/api/admin/whitelist/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: user.email,
          targetEmail,
          status: 'rejected',
        }),
      });
      const data = await res.json();
      if (res.ok && (data.ok || data.success)) {
        flashMessage(`已拒絕 / 停用 ${targetEmail} 的使用權限。`);
        await fetchAdminWhitelist();
        if (user.email.toLowerCase() === targetEmail.toLowerCase()) {
          await fetchDevQuota();
        }
      } else {
        flashMessage(`操作失敗：${data.error || '無法完成停用'}`);
      }
    } catch (err: any) {
      flashMessage(`操作發生錯誤：${err.message}`);
    } finally {
      setAdminActionLoadingKey(null);
    }
  };

  const handleAdminDelete = async (targetEmail: string) => {
    if (!user?.email) return;
    if (!window.confirm(`確定要將 ${targetEmail} 從白名單記錄中完全刪除嗎？`)) return;
    setAdminActionLoadingKey(`delete_${targetEmail}`);
    try {
      const res = await fetch('/api/admin/whitelist/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: user.email,
          targetEmail,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.ok || data.success)) {
        flashMessage(`已刪除 ${targetEmail} 的白名單記錄。`);
        await fetchAdminWhitelist();
        if (user.email.toLowerCase() === targetEmail.toLowerCase()) {
          await fetchDevQuota();
        }
      } else {
        flashMessage(`刪除失敗：${data.error || '無法刪除白名單記錄'}`);
      }
    } catch (err: any) {
      flashMessage(`刪除發生錯誤：${err.message}`);
    } finally {
      setAdminActionLoadingKey(null);
    }
  };

  const handleOpenEditUser = (u: AiWhitelistUser) => {
    setSelectedWhitelistUser(u);
    setFormEmail(u.email);
    setFormDisplayName(u.displayName || '');
    setFormDailyLimit(u.dailyLimit || 20);
    setFormStatus(u.status);
    setFormNotes(u.notes || '');
    setFormResetToday(false);
    setShowEditWhitelistModal(true);
  };

  const handleSaveEditUser = async () => {
    if (!user?.email || !selectedWhitelistUser) return;
    setSubmittingAdminForm(true);
    try {
      const res = await fetch('/api/admin/whitelist/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: user.email,
          targetEmail: selectedWhitelistUser.email,
          status: formStatus,
          dailyLimit: Number(formDailyLimit) || 20,
          notes: formNotes,
          resetTodayUsage: formResetToday,
          displayName: formDisplayName,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.ok || data.success)) {
        flashMessage(`已更新 ${selectedWhitelistUser.email} 的設定！`);
        setShowEditWhitelistModal(false);
        await fetchAdminWhitelist();
        if (user.email.toLowerCase() === selectedWhitelistUser.email.toLowerCase()) {
          await fetchDevQuota();
        }
      } else {
        flashMessage(`儲存失敗：${data.error || '更新設定失敗'}`);
      }
    } catch (err: any) {
      flashMessage(`儲存發生錯誤：${err.message}`);
    } finally {
      setSubmittingAdminForm(false);
    }
  };

  const handleCreateWhitelistUser = async () => {
    if (!user?.email) return;
    if (!formEmail.trim() || !formEmail.includes('@')) {
      flashMessage('請輸入有效的使用者 Email 信箱！');
      return;
    }
    setSubmittingAdminForm(true);
    try {
      const res = await fetch('/api/admin/whitelist/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminEmail: user.email,
          targetEmail: formEmail.trim(),
          displayName: formDisplayName.trim(),
          status: formStatus,
          dailyLimit: Number(formDailyLimit) || 20,
          notes: formNotes,
        }),
      });
      const data = await res.json();
      if (res.ok && (data.ok || data.success)) {
        flashMessage(`已成功將 ${formEmail.trim()} 加入白名單！`);
        setShowAddWhitelistModal(false);
        setFormEmail('');
        setFormDisplayName('');
        setFormNotes('');
        await fetchAdminWhitelist();
      } else {
        flashMessage(`新增失敗：${data.error || '新增白名單使用者失敗'}`);
      }
    } catch (err: any) {
      flashMessage(`新增發生錯誤：${err.message}`);
    } finally {
      setSubmittingAdminForm(false);
    }
  };

  // Profile calculations
  const calculateBmrTdee = () => {
    const gender = userProfile.gender;
    const age = Number(userProfile.age) || 20;
    const heightCm = Number(userProfile.heightCm) || 170;
    const currentWeightKg = Number(userProfile.currentWeightKg) || 70;
    const activityLevel = userProfile.activityLevel;
    const fitnessGoal = userProfile.fitnessGoal;

    // Mifflin-St Jeor formula
    let bmr = 10 * currentWeightKg + 6.25 * heightCm - 5 * age;
    bmr += gender === 'male' ? 5 : -161;

    // Activity multiplier
    const multipliers: Record<string, number> = {
      sedentary: 1.2,
      light: 1.375,
      moderate: 1.55,
      heavy: 1.725,
      athlete: 1.9,
    };
    const tdee = Math.round(bmr * (multipliers[activityLevel] || 1.55));

    // Goal adjustment
    let targetCal = tdee;
    if (fitnessGoal === 'fat_loss') targetCal -= 400;
    if (fitnessGoal === 'muscle_gain') targetCal += 300;

    // Macro distribution (approx: 2g protein/kg, 0.8g fat/kg, rest carbs)
    const targetProtein = Math.round(currentWeightKg * 2.0);
    const targetFat = Math.round(currentWeightKg * 0.8);
    const remainingCal = targetCal - (targetProtein * 4 + targetFat * 9);
    const targetCarbs = Math.max(50, Math.round(remainingCal / 4));

    return {
      bmr: Math.round(bmr),
      tdee,
      targetCal,
      targetProtein,
      targetFat,
      targetCarbs,
    };
  };

  const calculated = calculateBmrTdee();

  // Apply BMR results to Carb Cycle Goals
  const handleApplyCalculatedToGoals = () => {
    const newPresets = { ...presets };
    newPresets.CUSTOM = {
      ...newPresets.CUSTOM,
      calories: Number(calculated.targetCal) || 0,
      carbs: Number(calculated.targetCarbs) || 0,
      protein: Number(calculated.targetProtein) || 0,
      fat: Number(calculated.targetFat) || 0,
    };
    setPresets(newPresets);
    StorageService.savePresets(newPresets);
    flashMessage('已將計算建議套用至「自訂」目標！');
  };

  // Save profile
  const handleSaveProfile = (newProf: any) => {
    setUserProfile(newProf);
    const cleanedProf: UserProfile = {
      ...newProf,
      age: Number(newProf.age) || 20,
      heightCm: Number(newProf.heightCm) || 170,
      currentWeightKg: Number(newProf.currentWeightKg) || 70,
      targetWeightKg: Number(newProf.targetWeightKg) || 65,
    };
    StorageService.saveUserProfile(cleanedProf);
    flashMessage('個人基本身體資料已更新！');
  };

  // Save Gemini Key
  const [syncingSharedKey, setSyncingSharedKey] = useState(false);

  const handleSyncSharedGeminiKey = async (options?: { apiKey?: string; syncMode?: 'env' | 'custom' }) => {
    if (!user?.email || user.email.toLowerCase() !== 'kevin10611@gmail.com') {
      flashMessage('僅限系統管理員操作');
      return;
    }
    const syncMode = options?.syncMode || (options?.apiKey ? 'custom' : 'env');
    const keyToSync = options?.apiKey?.trim() || '';

    if (syncMode === 'custom' && (!keyToSync || keyToSync.length < 10)) {
      flashMessage('請填寫長度足夠的有效 Gemini API Key！');
      return;
    }

    setSyncingSharedKey(true);
    try {
      const res = await fetch('/api/admin/save-shared-gemini-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: user.email,
          apiKey: syncMode === 'custom' ? keyToSync : undefined,
          syncMode,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        flashMessage(data.message || '成功！Gemini API 金鑰已通過連線測試並同步至雲端共享庫。');
        setSharedKeyStatus({
          hasKey: true,
          firestoreSynced: true,
          source: 'firestore',
          maskedKey: data.maskedKey || (keyToSync ? `${keyToSync.slice(0, 6)}...${keyToSync.slice(-4)}` : 'AQ.Ab8...hCHg'),
          lastTestedModel: data.modelUsed,
        });
        setShowAdminSyncModal(false);
      } else {
        flashMessage(`同步失敗：${data.error || '請檢查金鑰'}`);
      }
    } catch (err: any) {
      flashMessage(`同步發生錯誤：${err.message}`);
    } finally {
      setSyncingSharedKey(false);
    }
  };

  const handleSaveGeminiKey = (key: string) => {
    if (!key.trim()) {
      handleClearGeminiKey();
      return;
    }
    setGeminiKey(key);
    StorageService.saveGeminiApiKey(key);
    setApiKeyStatus('saved');
    setTimeout(() => setApiKeyStatus('none'), 5000);
    flashMessage('Gemini API 個人自備金鑰已儲存！');
  };

  const handleClearGeminiKey = () => {
    setGeminiKey('');
    StorageService.saveGeminiApiKey('');
    setApiKeyStatus('deleted');
    setTimeout(() => setApiKeyStatus('none'), 5000);
    flashMessage('Gemini API 金鑰已清空');
  };

  const handleModelChange = (model: string) => {
    setAiModel(model);
    StorageService.saveSelectedAiModel(model);
    flashMessage(`已切換模型至 ${model}`);
  };

  // AI Connection Test
  const [testingAi, setTestingAi] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message?: string;
    modelUsed?: string;
    requestedModel?: string;
    latencyMs?: number;
    error?: string;
    quotaRemaining?: number;
  } | null>(null);

  // Firebase Connection Test
  const [testingFirebase, setTestingFirebase] = useState(false);
  const [firebaseStatus, setFirebaseStatus] = useState<{
    success?: boolean;
    message?: string;
    latencyMs?: number;
    details?: any;
  } | null>(null);

  const handleTestFirebase = async () => {
    setTestingFirebase(true);
    setFirebaseStatus(null);
    try {
      let result = await testFirebaseConnection();
      if (!result.success) {
        // Fallback or verify with backend API endpoint
        const srvRes = await fetch('/api/firebase/test-connection')
          .then((r) => r.json())
          .catch(() => null);
        if (srvRes && srvRes.success) {
          result = {
            success: true,
            latencyMs: srvRes.latencyMs,
            message: srvRes.message,
            details: srvRes.details,
          };
        }
      }
      setFirebaseStatus(result);
    } catch (err: any) {
      setFirebaseStatus({
        success: false,
        message: err?.message || '測試連線過程發生未知錯誤',
      });
    } finally {
      setTestingFirebase(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingAi(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customApiKey: aiKeySource === 'custom' ? geminiKey : undefined,
          apiKeySource: aiKeySource,
          model: aiModel,
          userEmail: user?.email || '',
          userUid: user?.uid || '',
        }),
      });
      const data = await res.json();
      if (data._usage) {
        StorageService.recordApiUsage(data._usage);
      }
      setTestResult(data);
      if (aiKeySource === 'developer') {
        fetchDevQuota();
      }
    } catch (err: any) {
      setTestResult({ ok: false, error: err.message || '連線伺服器逾時或失敗' });
    } finally {
      setTestingAi(false);
    }
  };

  // JSON Export / Backup
  const handleExportJson = () => {
    const jsonStr = StorageService.exportData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitpocket_backup_${getTodayString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // HTML Export Report
  const handleExportHtml = () => {
    setShowExportHtmlModal(true);
  };

  // JSON Import
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const content = reader.result as string;
        // Verify JSON before processing
        JSON.parse(content); 
        
        flashMessage('正在匯入並備份至雲端...');
        const success = StorageService.importData(content);
        if (success) {
          flashMessage('資料匯入成功且已同步至雲端！系統將自動重新載入...');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          flashMessage('匯入失敗，請確認檔案格式是否正確。');
        }
      } catch (err) {
        flashMessage('檔案格式錯誤，無法解析 JSON。');
      }
    };
    reader.readAsText(file);
  };

  const presetFoodCount = StorageService.getPresetFoods().length;

  // Filtered Whitelist for Admin
  const filteredWhitelist = adminWhitelist.filter((u: AiWhitelistUser) => {
    if (adminFilter !== 'all' && u.status !== adminFilter) return false;
    if (adminSearch.trim()) {
      const q = adminSearch.toLowerCase();
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      const matchName = (u.displayName || '').toLowerCase().includes(q);
      const matchNotes = (u.notes || '').toLowerCase().includes(q);
      return matchEmail || matchName || matchNotes;
    }
    return true;
  });

  const pendingCount = adminWhitelist.filter((u) => u.status === 'pending').length;
  const approvedCount = adminWhitelist.filter((u) => u.status === 'approved').length;
  const totalCallsToday = adminWhitelist.reduce((acc, curr) => acc + (curr.todayUsage || 0), 0);

  const getTodayLADate = () => {
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      return formatter.format(new Date());
    } catch {
      const d = new Date();
      d.setHours(d.getHours() - 7); // Pacific Time
      return d.toISOString().split('T')[0];
    }
  };

  const todayLADate = getTodayLADate();
  const todayHistoryItem = dailyHistory.find((item) => item.date === todayLADate);
  const todayTotalCalls = todayHistoryItem ? todayHistoryItem.calls : totalCallsToday;
  const todayTotalTokens = todayHistoryItem ? todayHistoryItem.tokens : 0;

  return (
    <div className="space-y-5 pb-28 max-w-2xl mx-auto">
      {/* Top Title */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-slate-900">系統與個人設定</h2>
          <p className="text-xs text-slate-500">
            TDEE/BMR 計算、碳循環目標、餐點管理與資料備份
          </p>
        </div>
        <div className="p-3 bg-sky-100 text-sky-800 rounded-2xl">
          <Settings className="w-5 h-5" />
        </div>
      </div>

      {savedMessage && (
        <div className="p-3 bg-sky-50 border border-sky-200 rounded-2xl text-xs font-bold text-sky-800 flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-sky-600" />
          <span>{savedMessage}</span>
        </div>
      )}

      {/* 0. Cloud Sync Section */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-sky-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              Google Drive 雲端同步
            </h3>
          </div>
          {user ? (
            hasDriveToken ? (
              <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-lg flex items-center gap-1">
                <Check className="w-3 h-3" /> 已連結雲端硬碟 (同步中)
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg flex items-center gap-1 animate-pulse">
                ⚠️ 授權已失效 (同步暫停)
              </span>
            )
          ) : (
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg">
              尚未授權
            </span>
          )}
        </div>

        {user ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="User" className="w-10 h-10 rounded-full border-2 border-white shadow-xs" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
                    <User className="w-6 h-6 text-sky-600" />
                  </div>
                )}
                <div>
                  <div className="text-xs font-black text-slate-900">{user.displayName}</div>
                  <div className="text-[10px] text-slate-500">{user.email}</div>
                </div>
              </div>
              <button
                onClick={handleLogin}
                className="p-2 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-xl transition"
                title="切換帳號"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>

            {!hasDriveToken && (
              <div className="bg-amber-50/80 border border-amber-200/50 p-4 rounded-2xl text-xs text-amber-800 space-y-2.5">
                <div className="font-bold flex items-center gap-1.5 text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Google Drive 同步授權已過期</span>
                </div>
                <p className="leading-relaxed text-amber-700">
                  Google 的安全機制規定<strong>第三方存取權限 (Access Token) 最長效期為 1 小時</strong>。為保護隱私，純前端架構不會永久儲存您的 Google 密碼。因此一段時間後需要手動修復以恢復背景同步。
                </p>
                <button
                  onClick={handleRestoreAuth}
                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>立即一鍵修復 / 重新授權 Google Drive</span>
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={async () => {
                  const token = await getAccessToken();
                  if (!token) {
                    flashMessage('偵測到雲端授權已過期，正在啟動一鍵修復...');
                    try {
                      const resLogin = await loginWithGoogle(false);
                      if (!resLogin.accessToken && resLogin.isRedirecting) return;
                      setHasDriveToken(true);
                    } catch (e) {
                      flashMessage('授權更新失敗，請重新點擊「授權連結」');
                      return;
                    }
                  }
                  flashMessage('正在與 Google Drive 同步...');
                  const res = await StorageService.syncFromCloud();
                  flashMessage(res.message);
                  if (res.success) {
                    setTimeout(() => window.location.reload(), 1200);
                  } else {
                    if (res.message.includes('授權已過期') || res.message.includes('權限')) {
                      setHasDriveToken(false);
                    }
                  }
                }}
                className="w-full py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-black rounded-xl border border-sky-100 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Database className="w-4 h-4" />
                <span>從雲端拉取最新數據</span>
              </button>

              <button
                onClick={async () => {
                  const token = await getAccessToken();
                  if (!token) {
                    flashMessage('偵測到雲端授權已過期，正在啟動一鍵修復...');
                    try {
                      const resLogin = await loginWithGoogle(false);
                      if (!resLogin.accessToken && resLogin.isRedirecting) return;
                      setHasDriveToken(true);
                    } catch (e) {
                      flashMessage('授權更新失敗，請重新點擊「授權連結」');
                      return;
                    }
                  }
                  flashMessage('正在上傳備份至 Google Drive...');
                  const success = await StorageService.saveToCloud();
                  if (success) {
                    flashMessage('成功備份至 Google Drive！');
                  } else {
                    setHasDriveToken(!!localStorage.getItem('fitpocket_google_access_token'));
                    flashMessage('備份失敗，請檢查權限或登入狀態');
                  }
                }}
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-black rounded-xl border border-sky-600 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>立即備份至雲端硬碟</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 leading-relaxed">
              授權後，您的所有紀錄將直接存儲於您個人的 Google Drive 中 (fitpocket_data.json)，確保數據隱私且支援跨裝置即時同步。
            </p>
            <button
              onClick={handleLogin}
              className="w-full py-3 bg-white border-2 border-slate-200 rounded-2xl text-xs font-black text-slate-700 hover:border-sky-400 hover:bg-sky-50/30 transition flex items-center justify-center gap-2 cursor-pointer group"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 group-hover:scale-110 transition" />
              <span>授權連結 Google 雲端硬碟</span>
            </button>
          </div>
        )}
      </div>

      {/* 1. AI BMR & TDEE Calculator */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-sky-600" />
            <h3 className="font-bold text-slate-900 text-sm">
              身體數值與 TDEE / BMR 試算
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-lg">
            Mifflin-St Jeor 公式
          </span>
        </div>

          {/* Inputs */}
          <div className="space-y-4">
            <div>
              <label className="block text-slate-500 mb-2 font-semibold">生理性別</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSaveProfile({ ...userProfile, gender: 'male' })}
                  className={`py-3 text-sm font-bold rounded-2xl border transition cursor-pointer ${
                    userProfile.gender === 'male'
                      ? 'bg-sky-800 text-white border-sky-800'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  男性
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveProfile({ ...userProfile, gender: 'female' })}
                  className={`py-3 text-sm font-bold rounded-2xl border transition cursor-pointer ${
                    userProfile.gender === 'female'
                      ? 'bg-rose-800 text-white border-rose-800'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  女性
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1 font-semibold">年齡</label>
                <input
                  type="number"
                  value={userProfile.age}
                  onChange={(e) =>
                    handleSaveProfile({
                      ...userProfile,
                      age: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-semibold">身高 (cm)</label>
                <input
                  type="number"
                  value={userProfile.heightCm}
                  onChange={(e) =>
                    handleSaveProfile({
                      ...userProfile,
                      heightCm: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-semibold">目前體重 (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={userProfile.currentWeightKg}
                  onChange={(e) =>
                    handleSaveProfile({
                      ...userProfile,
                      currentWeightKg: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1 font-semibold">目標體重 (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={userProfile.targetWeightKg}
                  onChange={(e) =>
                    handleSaveProfile({
                      ...userProfile,
                      targetWeightKg: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-500 mb-2 font-semibold">活動強度</label>
              <div className="flex flex-col gap-2">
                {[
                  { id: 'sedentary', label: '久坐無運動 (×1.2)' },
                  { id: 'light', label: '輕度運動 1-3天 (×1.375)' },
                  { id: 'moderate', label: '中度運動 3-5天 (×1.55)' },
                  { id: 'heavy', label: '重度運動 6-7天 (×1.725)' },
                  { id: 'athlete', label: '運動員密集高強度 (×1.9)' },
                ].map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => handleSaveProfile({ ...userProfile, activityLevel: l.id as any })}
                    className={`py-2.5 px-4 text-xs font-bold rounded-xl border transition cursor-pointer text-left ${
                      userProfile.activityLevel === l.id
                        ? 'bg-sky-800 text-white border-sky-800'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

        <div>
          <label className="block text-slate-500 mb-1 font-semibold text-xs">健身與飲食目標</label>
          <div className="flex flex-col gap-2">
            {[
              { id: 'fat_loss', label: '減脂 (-400kcal)' },
              { id: 'maintain', label: '維持平衡 (維持TDEE)' },
              { id: 'muscle_gain', label: '增肌 (+300kcal)' },
            ].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() =>
                  handleSaveProfile({
                    ...userProfile,
                    fitnessGoal: g.id as any,
                  })
                }
                className={`py-2 px-3 text-xs font-bold rounded-xl border transition cursor-pointer text-left ${
                  userProfile.fitnessGoal === g.id
                    ? 'bg-sky-600 text-white border-sky-600'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Calculation Result Banner */}
        <div className="bg-sky-50/70 border border-sky-200/60 p-4 rounded-2xl space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block">基礎代謝 BMR</span>
              <span className="text-base font-black text-slate-800">
                {calculated.bmr} <span className="text-xs">kcal</span>
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 block">每日消耗 TDEE</span>
              <span className="text-base font-black text-slate-800">
                {calculated.tdee} <span className="text-xs">kcal</span>
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-sky-800 block">推薦每日目標</span>
              <span className="text-base font-black text-sky-800">
                {calculated.targetCal} <span className="text-xs">kcal</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 border-t border-sky-200/50 text-xs">
            <div className="text-slate-600">
              建議分配：C <strong className="text-amber-800">{calculated.targetCarbs}g</strong> ·
              P <strong className="text-blue-800">{calculated.targetProtein}g</strong> · F{' '}
              <strong className="text-rose-800">{calculated.targetFat}g</strong>
            </div>

            <button
              type="button"
              onClick={handleApplyCalculatedToGoals}
              className="w-full px-3 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              一鍵套用至自訂目標
            </button>
          </div>

          {/* Carb Cycle Goals Preview */}
          <div className="pt-3 border-t border-sky-200/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">各循環日目標 (高/中/低/自訂碳)</span>
              <button
                type="button"
                onClick={() => setShowGoalModal(true)}
                className="px-2.5 py-1 bg-white hover:bg-sky-100 text-sky-800 text-[11px] font-bold rounded-lg border border-sky-200 transition flex items-center gap-1 cursor-pointer"
              >
                <span>編輯目標</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['HIGH', 'MEDIUM', 'LOW', 'CUSTOM'] as CarbCycleType[]).map((c) => {
                const info = CARB_CYCLE_INFO[c];
                const p = presets[c];
                const badgeStyle = getCarbCycleBadgeStyle(c, true);
                return (
                  <div
                    key={c}
                    onClick={() => setShowGoalModal(true)}
                    className="p-2.5 bg-white border border-slate-200/80 rounded-xl hover:border-sky-300 transition cursor-pointer space-y-1.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 ${badgeStyle}`}>
                        <span>{info.emoji}</span>
                        <span>{info.shortName}</span>
                      </span>
                      <span className="text-xs font-black text-slate-800">{p?.calories || 0} <span className="text-[10px] text-slate-400 font-normal">kcal</span></span>
                    </div>
                    <div className="text-[10px] font-bold flex items-center justify-between text-slate-600 pt-1 border-t border-slate-100">
                      <span className="text-amber-700">C {p?.carbs || 0}g</span>
                      <span className="text-blue-700">P {p?.protein || 0}g</span>
                      <span className="text-rose-700">F {p?.fat || 0}g</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Food Database & Custom Foods Management */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-600" />
            <h3 className="font-bold text-slate-900 text-sm">食品資料庫管理</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingCustomFood(undefined);
              setShowCustomFoodModal(true);
            }}
            className="text-xs font-bold text-sky-800 hover:text-sky-950 flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> 新增自訂食物
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 text-center text-xs">
          <div className="p-3 bg-slate-50 rounded-2xl flex justify-between items-center">
            <span className="text-slate-500 font-semibold">衛福部官方基礎食材庫</span>
            <span className="font-bold text-slate-800 text-sm">{presetFoodCount} 筆</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-2xl flex justify-between items-center">
            <span className="text-slate-500 font-semibold">我的常用自訂</span>
            <span className="font-bold text-sky-800 text-sm">{customFoods.length} 筆</span>
          </div>
          <div className="p-3 bg-slate-50 rounded-2xl flex justify-between items-center">
            <span className="text-slate-500 font-semibold">公共網路擴充資料庫</span>
            <span className="font-bold text-sky-800 text-sm">
              {cloudFoodCount !== null ? `${cloudFoodCount} 筆` : '讀取中...'}
            </span>
          </div>
        </div>

        {customFoods.length > 0 && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                setCustomFoodsSearchQuery('');
                setShowCustomFoodsListModal(true);
              }}
              className="w-full py-2.5 px-4 bg-sky-50 hover:bg-sky-100/80 border border-sky-100 text-sky-800 text-xs font-bold rounded-xl shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Search className="w-3.5 h-3.5 text-sky-600" />
              <span>管理自訂食物清單 ({customFoods.length} 筆)</span>
            </button>
          </div>
        )}
      </div>

      {/* 5. Gemini AI Configuration & Whitelist */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Gemini AI 金鑰與模式設定</h3>
              <p className="text-[11px] text-slate-400">支援「開發者共享金鑰 (白名單審核制)」與「自備個人金鑰」</p>
            </div>
          </div>
          <div>
            {aiKeySource === 'developer' ? (
              <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                開發者共享模式
              </span>
            ) : geminiKey ? (
              <span className="px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-full text-xs font-bold whitespace-nowrap">
                個人金鑰已設定
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-bold whitespace-nowrap">
                個人金鑰未設定
              </span>
            )}
          </div>
        </div>

        {/* Dual Mode Switcher Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/60">
          <button
            type="button"
            onClick={() => handleAiKeySourceChange('developer')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              aiKeySource === 'developer'
                ? 'bg-white text-purple-700 shadow-sm border border-purple-200/60'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            <Shield className="w-4 h-4 text-purple-600" />
            <span>開發者共享金鑰 (白名單審核制)</span>
          </button>
          <button
            type="button"
            onClick={() => handleAiKeySourceChange('custom')}
            className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
              aiKeySource === 'custom'
                ? 'bg-white text-sky-700 shadow-sm border border-sky-200/60'
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
            }`}
          >
            <Key className="w-4 h-4 text-sky-600" />
            <span>個人自備 API 金鑰 (無限制)</span>
          </button>
        </div>

        {/* Developer Mode Content */}
        {aiKeySource === 'developer' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="bg-purple-50/70 border border-purple-100 p-3.5 rounded-2xl text-xs text-purple-900 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  每日 20 次限額
                </span>
              </div>
              <p className="leading-relaxed text-purple-800/90 text-[11px]">
                開發者金鑰由後端安全保管，不暴露於瀏覽器前端。為避免 API 額度超載，使用前需經由開發者審核通過白名單，通過後每日享免費 20 次 AI 智慧辨識呼叫額度。
              </p>
            </div>

            {!user ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-amber-900">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>使用開發者共享金鑰需先登入 Google 帳號以辨識使用者身分。</span>
                </div>
                <button
                  type="button"
                  onClick={handleLogin}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl whitespace-nowrap transition cursor-pointer shadow-xs"
                >
                  立即登入 Google 帳號
                </button>
              </div>
            ) : (
              <div className="p-3.5 pt-3 pb-2 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {user.displayName ? user.displayName.slice(0, 1) : user.email?.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5 flex-wrap">
                        <span className="truncate max-w-[100px] sm:max-w-none">{user.displayName || 'Google 使用者'}</span>
                        {devQuota?.isAdmin && (
                          <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 border border-amber-300 rounded text-[9px] font-extrabold flex items-center gap-0.5 whitespace-nowrap">
                            <Crown className="w-2.5 h-2.5 text-amber-600" />
                            系統管理員
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[150px] sm:max-w-none">{user.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Status Badge */}
                    {loadingDevQuota ? (
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" /> 查詢中...
                      </span>
                    ) : devQuota?.status === 'approved' ? (
                      <span className="px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-sky-600" />
                        已核准
                      </span>
                    ) : devQuota?.status === 'pending' ? (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3 text-amber-600" />
                        審核中
                      </span>
                    ) : devQuota?.status === 'rejected' ? (
                      <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                        <UserX className="w-3 h-3 text-rose-600" />
                        已停用
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-slate-200/80 text-slate-600 rounded-full text-[10px] font-bold">
                        尚未申請
                      </span>
                    )}

                    {/* Quick Edit Pen for Admin/Approved users */}
                    {devQuota && (devQuota.isAdmin || devQuota.status === 'approved') && (
                      <button
                        type="button"
                        onClick={() => {
                          const me = adminWhitelist.find(u => u.email.toLowerCase() === user.email?.toLowerCase());
                          if (me) {
                            handleOpenEditUser(me);
                          } else if (devQuota.isAdmin) {
                            handleOpenEditUser({
                              email: user.email || '',
                              displayName: user.displayName || '',
                              status: 'approved',
                              dailyLimit: devQuota.dailyLimit,
                              todayUsage: devQuota.todayUsage,
                              totalUsage: devQuota.todayUsage,
                              requestedAt: Date.now(),
                              quotaCycleDate: devQuota.quotaCycleDate || '',
                              lastUsedAt: Date.now()
                            });
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all cursor-pointer group"
                        title="編輯我的資料與配額"
                      >
                        <Edit2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Quota Progress & Details */}
                {devQuota?.status === 'approved' ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500 font-bold flex items-center gap-1">
                        <Activity className="w-3 h-3 text-purple-600" />
                        今日配額消耗
                      </span>
                      <span className="font-black text-purple-700 text-xs">
                        {devQuota.todayUsage} / {devQuota.dailyLimit} 
                        <span className="text-slate-400 font-normal ml-1 text-[10px]">
                          (餘 {devQuota.remaining})
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] mt-1">
                      <span className="text-slate-500 font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-600" />
                        總 Token 消耗量
                      </span>
                      <span className="font-black text-amber-700 text-xs">
                        {devQuota.totalTokensUsed.toLocaleString()}
                      </span>
                    </div>

                    <div className="w-full bg-slate-200/50 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          devQuota.todayUsage >= devQuota.dailyLimit
                            ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'
                            : devQuota.todayUsage >= devQuota.dailyLimit * 0.8
                            ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                            : 'bg-purple-600 shadow-[0_0_8px_rgba(147,51,234,0.3)]'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            (devQuota.todayUsage / Math.max(1, devQuota.dailyLimit)) * 100
                          )}%`,
                        }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[9px] text-slate-400">
                      <span className="opacity-80">自動重置：每日 00:00 (PST)</span>
                      <button
                        type="button"
                        onClick={fetchDevQuota}
                        className="text-purple-600 hover:text-purple-700 font-bold flex items-center gap-0.5 cursor-pointer hover:underline transition-colors"
                      >
                        <RefreshCw className="w-2.5 h-2.5" /> 重新整理
                      </button>
                    </div>

                    {/* Admin Global Shared Key Sync Banner */}
                    {devQuota?.isAdmin && (
                      <div className="mt-3 p-3.5 bg-purple-50/90 border border-purple-200/80 rounded-2xl flex flex-col gap-3 text-xs">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-purple-950 font-bold flex-wrap">
                              <Crown className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>全域共享 AI 金鑰狀態：</span>
                              {sharedKeyStatus?.firestoreSynced ? (
                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  雲端庫已就緒 (白名單可使用)
                                </span>
                              ) : sharedKeyStatus?.hasKey ? (
                                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  僅伺服器環境 (請同步至雲端庫)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-200 rounded-full text-[10px] font-bold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                  未同步金鑰
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-purple-800/80 font-medium">
                              {sharedKeyStatus?.hasKey ? (
                                <>
                                  金鑰縮圖：<code className="bg-purple-100 px-1.5 py-0.5 rounded font-mono text-purple-900 font-bold">{sharedKeyStatus.maskedKey}</code>
                                  {sharedKeyStatus.firestoreSynced ? ' · 雲端 Firestore 共享庫同步中' : ' · 尚未寫入雲端 Firestore'}
                                </>
                              ) : (
                                '白名單使用者需依賴全域共享金鑰。請於下方設定個人 Key 後點擊「同步金鑰至雲端庫」。'
                              )}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleTestSharedKey()}
                              disabled={testingSharedKey || !sharedKeyStatus?.hasKey}
                              className="flex-1 sm:flex-none px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                              title="執行端對端自動化測試"
                            >
                              {testingSharedKey ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>測試中...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>自動化測試</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAdminCustomKeyInput('');
                                setAdminSyncTab('env');
                                setShowAdminSyncModal(true);
                              }}
                              disabled={syncingSharedKey}
                              className="flex-1 sm:flex-none px-3.5 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>{sharedKeyStatus?.firestoreSynced ? '同步/更新金鑰' : '同步金鑰至雲端庫'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Automated Diagnostic Result Alert */}
                        {adminTestResult && (
                          <div
                            className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${
                              adminTestResult.ok
                                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                : 'bg-rose-50 text-rose-900 border-rose-200'
                            }`}
                          >
                            <span className="font-bold shrink-0">
                              {adminTestResult.ok ? '✓ 自動化診斷通過：' : '✕ 自動化診斷失敗：'}
                            </span>
                            <span>{adminTestResult.message}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : devQuota?.status === 'pending' ? (
                  <div className="bg-amber-50/70 border border-amber-100 p-3 rounded-xl text-xs text-amber-800 flex items-center justify-between gap-2">
                    <span>您的共享金鑰申請已送交管理員，核准後即可每日使用 20 次。</span>
                    <button
                      type="button"
                      onClick={fetchDevQuota}
                      className="px-2.5 py-1 bg-amber-200/70 hover:bg-amber-200 text-amber-900 rounded-lg text-[11px] font-bold cursor-pointer shrink-0"
                    >
                      重新整理狀態
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                    <span className="text-xs text-slate-600">
                      尚未取得白名單資格。點擊下方按鈕即可向管理員送出使用申請。
                    </span>
                    <button
                      type="button"
                      onClick={handleRequestAccess}
                      disabled={requestingAccess}
                      className="w-full sm:w-auto px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{requestingAccess ? '送出申請中...' : '送出白名單使用申請'}</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Custom API Key Mode Content */}
        {aiKeySource === 'custom' && (
          <div className="space-y-3 animate-in fade-in duration-200">
            <div className="bg-sky-50/70 border border-sky-100 p-3.5 rounded-2xl text-xs text-sky-900 space-y-2">
              <p className="font-bold">💡 為什麼需要填寫個人的 API Key？</p>
              <p className="leading-relaxed text-sky-800 text-[11px]">
                使用個人的 Google Gemini API Key 可享有個人專屬的官方免費或付費額度，無每日 20 次限制，資料傳輸更獨立。金鑰僅儲存在您的瀏覽器本機與授權資料庫中。
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowApiKeyModal(true)}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-2xl text-xs transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
            >
              <Key className="w-4 h-4" />
              <span>{geminiKey ? '修改 / 更新個人 Gemini API Key' : '立即設定個人 Gemini API Key'}</span>
            </button>
          </div>
        )}

        {/* Dynamic Model Switcher (Gemini 3.x only) */}
        <div className="mt-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">
            AI 模型選擇 (僅限使用 3.x 家族架構)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'].map((m) => (
              <button
                key={m}
                onClick={() => handleModelChange(m)}
                className={`flex-[1_0_45%] py-2 text-[10px] font-bold rounded-xl transition cursor-pointer ${
                  aiModel === m
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white text-slate-500 border border-slate-100 hover:border-purple-200'
                }`}
              >
                {m.replace('gemini-', '')}
              </button>
            ))}
          </div>
        </div>

        {/* Connection Test Action & Status */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testingAi}
            className="w-full py-2.5 px-4 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${testingAi ? 'animate-spin' : ''}`} />
            <span>{testingAi ? '正在測試 AI 通訊與延遲...' : '即時測試目前 AI 連線狀態'}</span>
          </button>

          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 ${
                testResult.ok
                  ? 'bg-sky-50 border border-sky-200 text-sky-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                {testResult.ok ? (
                  <Check className="w-4 h-4 text-sky-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                )}
                <span>{testResult.ok ? 'AI 連線正常' : 'AI 連線失敗'}</span>
              </div>
              {testResult.ok ? (
                <div className="text-[11px] text-sky-700 space-y-0.5">
                  <p>• 運作模型：<span className="font-mono font-semibold">{testResult.modelUsed}</span></p>
                  <p>• 回應延遲：<span className="font-semibold">{testResult.latencyMs} 毫秒</span></p>
                  {aiKeySource === 'developer' && testResult.quotaRemaining !== undefined && (
                    <p>• 今日開發者共享配額剩餘：<span className="font-bold text-purple-800">{testResult.quotaRemaining} 次</span></p>
                  )}
                  <p className="text-sky-600/90 font-medium">智慧飲食估算、照片辨識、訓練推薦等所有 AI 功能皆已就緒！</p>
                </div>
              ) : (
                <div className="text-[11px] text-rose-700 space-y-2">
                  <p className="font-semibold">{testResult.error || '請確認 API 金鑰是否有效或網路通訊正常。'}</p>
                  {(testResult.error?.includes('Permission Denied') || testResult.error?.includes('403') || testResult.error?.includes('denied access') || testResult.error?.includes('拒絕')) && (
                    <div className="p-3 bg-white/90 border border-rose-200 rounded-xl space-y-1.5 text-rose-900">
                      <p className="font-bold flex items-center gap-1.5 text-[11px]">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Google 403 權限拒絕說明與解決建議：</span>
                      </p>
                      <p className="text-[10px] leading-relaxed text-slate-700">
                        此金鑰對應的 Google Cloud 專案未開通 Generative Language API 或專案被限制。請至{' '}
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-700 underline font-bold"
                        >
                          Google AI Studio API Keys
                        </a>
                        ，點擊「Create API key」並選擇新專案 (Create API key in new project)。
                      </p>
                      {aiKeySource === 'custom' && (
                        <button
                          type="button"
                          onClick={() => handleAiKeySourceChange('developer')}
                          className="w-full mt-1 py-2 px-3 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold text-[11px] transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>一鍵改用「開發者共享 AI 金鑰」</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Firebase Firestore Connection Status & Test */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <Database className="w-3.5 h-3.5 text-amber-600" />
                <span>Firebase 共享資料庫連線檢測</span>
              </div>
              <button
                type="button"
                onClick={handleTestFirebase}
                disabled={testingFirebase}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${testingFirebase ? 'animate-spin' : ''}`} />
                {testingFirebase ? '檢測中...' : '即時測試連線'}
              </button>
            </div>

            {firebaseStatus && (
              <div
                className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
                  firebaseStatus.success
                    ? 'bg-sky-50 text-sky-800 border-sky-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {firebaseStatus.success ? (
                  <Check className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 space-y-1">
                  <div className="font-bold">{firebaseStatus.message}</div>
                  {firebaseStatus.details && (
                    <div className="font-mono text-[10px] bg-white/70 p-2 rounded-lg border border-rose-200 text-rose-900 leading-tight space-y-0.5">
                      <div>錯誤代碼: {firebaseStatus.details.code}</div>
                      <div>專案 ID: {firebaseStatus.details.projectId}</div>
                      <div>資料庫 ID: {firebaseStatus.details.databaseId}</div>
                      {firebaseStatus.details.rawMessage && (
                        <div className="break-all opacity-80 mt-1">訊息: {firebaseStatus.details.rawMessage}</div>
                      )}
                    </div>
                  )}
                  <div className="text-[11px] opacity-80 mt-0.5">
                    資料庫安全規則（Rules）已設定放寬，支援公共食品庫擴充與即時讀寫。
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 👑 5.0.5 Admin Whitelist Management Panel (Visible ONLY to Kevin10611@gmail.com) */}
      {isAdmin && (
        <div className="bg-gradient-to-br from-amber-500/10 via-purple-500/5 to-white rounded-3xl p-5 border-2 border-amber-400/60 shadow-md space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                  <span>開發者專屬管理後台：AI 白名單與配額控管</span>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded text-[10px] font-extrabold">
                    Admin
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  即時審核使用者申請、自訂個別使用者每日呼叫次數上限 (強制 20 次防護)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full">
              <button
                type="button"
                onClick={() => {
                  setShowDatabaseFoodModal(true);
                  setSelectedCollection('cloud_foods');
                  fetchAdminDatabaseFoods('cloud_foods');
                }}
                className="w-full px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <Database className="w-4 h-4" />
                <span>管理食品資料庫</span>
              </button>
              <button
                type="button"
                onClick={fetchAdminWhitelist}
                disabled={loadingAdminWhitelist}
                className="w-full px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loadingAdminWhitelist ? 'animate-spin' : ''}`} />
                <span>重新整理</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormEmail('');
                  setFormDisplayName('');
                  setFormDailyLimit(20);
                  setFormStatus('approved');
                  setFormNotes('');
                  setShowAddWhitelistModal(true);
                }}
                className="w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>手動新增使用者</span>
              </button>
              
              {!showClearConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  disabled={clearingStats}
                  className="w-full px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>清除全站統計次數</span>
                </button>
              ) : (
                <div className="flex gap-1.5 w-full">
                  <button
                    type="button"
                    onClick={handleClearUsageStats}
                    disabled={clearingStats}
                    className="flex-1 px-2 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-[10px] sm:text-xs font-extrabold rounded-xl transition flex items-center justify-center gap-1 shadow-xs cursor-pointer disabled:opacity-50 animate-pulse"
                  >
                    <span>確定清除！</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    disabled={clearingStats}
                    className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] sm:text-xs font-bold rounded-xl transition flex items-center justify-center cursor-pointer disabled:opacity-50"
                  >
                    <span>取消</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Admin Quick Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase">總註冊/申請用戶</span>
              <span className="text-xl font-black text-slate-800 mt-1">{adminWhitelist.length} 人</span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-amber-200/80 shadow-2xs flex flex-col">
              <span className="text-[10px] font-bold text-amber-600 uppercase flex items-center gap-1">
                待審核申請
                {pendingCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block" />
                )}
              </span>
              <span className="text-xl font-black text-amber-600 mt-1">{pendingCount} 人</span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-sky-200/80 shadow-2xs flex flex-col">
              <span className="text-[10px] font-bold text-sky-600 uppercase">今日總呼叫次數</span>
              <span className="text-xl font-black text-sky-600 mt-1">{todayTotalCalls} 次</span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-emerald-200/80 shadow-2xs flex flex-col">
              <span className="text-[10px] font-bold text-emerald-600 uppercase">今日總 Token</span>
              <span className="text-xl font-black text-emerald-600 mt-1 truncate" title={todayTotalTokens.toLocaleString()}>
                {todayTotalTokens.toLocaleString()}
              </span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-indigo-200/80 shadow-2xs flex flex-col">
              <span className="text-[10px] font-bold text-indigo-600 uppercase">全站總呼叫次數</span>
              <span className="text-xl font-black text-indigo-700 mt-1">
                {adminWhitelist.reduce((acc, curr) => acc + (Number(curr.totalUsage) || 0), 0)} 次
              </span>
            </div>
            <div className="bg-white p-3 rounded-2xl border border-purple-200/80 shadow-2xs flex flex-col">
              <span className="text-[10px] font-bold text-purple-600 uppercase">全站 Token 總量</span>
              <span className="text-xl font-black text-purple-700 mt-1 truncate" title={adminWhitelist.reduce((acc, curr) => acc + (Number(curr.totalTokensUsed) || 0), 0).toLocaleString()}>
                {adminWhitelist.reduce((acc, curr) => acc + (Number(curr.totalTokensUsed) || 0), 0).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                placeholder="搜尋 Email、暱稱或備註..."
                className="w-full pl-8.5 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
              {adminSearch && (
                <button
                  type="button"
                  onClick={() => setAdminSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Status Filter Buttons */}
            <div className="flex flex-wrap gap-1 w-full sm:w-auto">
              {[
                { id: 'all', label: '全部' },
                { id: 'pending', label: `待審核 (${pendingCount})` },
                { id: 'approved', label: `已核准 (${approvedCount})` },
                { id: 'rejected', label: '已拒絕' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAdminFilter(tab.id as any)}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                    adminFilter === tab.id
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Whitelist Users List */}
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {loadingAdminWhitelist && adminWhitelist.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>讀取白名單名冊中...</span>
              </div>
            ) : filteredWhitelist.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                尚無符合篩選條件的使用者記錄
              </div>
            ) : (
              filteredWhitelist.map((u) => (
                <div
                  key={u.email}
                  className={`p-3.5 bg-white rounded-2xl border transition-all ${
                    u.status === 'pending'
                      ? 'border-amber-300 shadow-xs bg-amber-50/20'
                      : u.status === 'approved'
                      ? 'border-slate-200/80'
                      : 'border-slate-200 opacity-70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    {/* User Info */}
                    <div className="flex items-start sm:items-center gap-2.5 flex-1 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 sm:mt-0">
                        {u.displayName ? u.displayName.slice(0, 1) : u.email.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs truncate max-w-[120px]">{u.displayName || '未設定暱稱'}</span>
                          <span className="text-[11px] text-slate-500 font-mono truncate max-w-[180px]">({u.email})</span>
                          {u.email.toLowerCase() === 'kevin10611@gmail.com' && (
                            <div className="flex items-center gap-1">
                              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 border border-amber-300 rounded text-[9px] font-extrabold flex items-center gap-0.5">
                                👑 管理員
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenEditUser(u)}
                                className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-all cursor-pointer"
                                title="編輯我的資料"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          {/* Status Badge */}
                          {u.status === 'approved' ? (
                            <span className="px-2 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-full text-[10px] font-bold">
                              已核准
                            </span>
                          ) : u.status === 'pending' ? (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold animate-pulse">
                              待審核
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[10px] font-bold">
                              已拒絕
                            </span>
                          )}
                        </div>

                        {/* Quota info */}
                        <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                          <span>
                            每日額度：<strong className="text-slate-800">{u.dailyLimit || 20} 次</strong>
                          </span>
                          <span>
                            今日已用：<strong className="text-purple-700">{u.todayUsage || 0} 次</strong>
                          </span>
                          {u.notes && (
                            <span className="text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] truncate max-w-[150px]">
                              備註: {u.notes}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {u.email.toLowerCase() !== 'kevin10611@gmail.com' && (
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        {u.status === 'pending' && (
                          <>
                            <button
                              type="button"
                              disabled={!!adminActionLoadingKey}
                              onClick={() => handleAdminApprove(u.email, u.dailyLimit || 20)}
                              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                            >
                              {adminActionLoadingKey === `approve_${u.email}` ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                              <span>核准 (20次)</span>
                            </button>
                            <button
                              type="button"
                              disabled={!!adminActionLoadingKey}
                              onClick={() => handleAdminReject(u.email)}
                              className="px-2 py-1 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                              {adminActionLoadingKey === `reject_${u.email}` ? (
                                <Loader2 className="w-3 h-3 animate-spin text-rose-600" />
                              ) : null}
                              <span>拒絕</span>
                            </button>
                          </>
                        )}

                        {u.status === 'approved' && (
                          <button
                            type="button"
                            disabled={!!adminActionLoadingKey}
                            onClick={() => handleAdminReject(u.email)}
                            className="px-2 py-1 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700 disabled:opacity-50 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer"
                          >
                            {adminActionLoadingKey === `reject_${u.email}` ? (
                              <Loader2 className="w-3 h-3 animate-spin text-rose-600" />
                            ) : null}
                            <span>停用</span>
                          </button>
                        )}

                        {u.status === 'rejected' && (
                          <button
                            type="button"
                            disabled={!!adminActionLoadingKey}
                            onClick={() => handleAdminApprove(u.email, u.dailyLimit || 20)}
                            className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1 cursor-pointer"
                          >
                            {adminActionLoadingKey === `approve_${u.email}` ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : null}
                            <span>重新核准</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={!!adminActionLoadingKey}
                          onClick={() => handleOpenEditUser(u)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-50 rounded-lg transition cursor-pointer"
                          title="編輯配額與設定"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          disabled={!!adminActionLoadingKey}
                          onClick={() => handleAdminDelete(u.email)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 rounded-lg transition cursor-pointer"
                          title="自白名單刪除"
                        >
                          {adminActionLoadingKey === `delete_${u.email}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 5.1 AI API Usage & Token Metrics */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">AI API 使用量與 Token 消耗統計</h3>
              <p className="text-[11px] text-slate-400">即時監控 API 請求次數與權杖消耗，支援每日自動重設與上限自訂</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenLimitModal}
              className="text-[11px] font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/80 px-2.5 py-1 rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-indigo-100"
              title="自訂每日 API 呼叫次數與 Token 上限"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>自訂每日上限</span>
            </button>
            {apiUsage.totalCalls > 0 && (
              <button
                type="button"
                onClick={() => setShowResetUsageConfirm(true)}
                className="text-[11px] font-bold text-slate-400 hover:text-rose-600 flex items-center gap-1 transition px-2 py-1 rounded-xl hover:bg-rose-50 cursor-pointer"
                title="重設統計數據"
              >
                <RotateCcw className="w-3 h-3" />
                <span>重設統計</span>
              </button>
            )}
          </div>
        </div>

        {/* Google API Daily Reset Cycle & Countdown Banner */}
        <div className="p-3.5 bg-gradient-to-r from-sky-50/70 via-indigo-50/50 to-purple-50/70 border border-sky-100/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <span>Google API 每日額度重設週期</span>
                <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono">
                  00:00 PT
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                每日太平洋時間 00:00（本地時間約 {resetInfo.formattedLocalTime}）自動將今日呼叫次數與 Token 歸零
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <div className="px-2.5 py-1 bg-white/90 border border-sky-200/80 rounded-xl text-slate-700 font-bold text-[11px] shadow-2xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>距離歸零：</span>
              <span className="font-mono text-indigo-700">
                {resetInfo.hoursRemaining} 時 {resetInfo.minutesRemaining} 分
              </span>
            </div>
          </div>
        </div>

        {/* Daily Quota Progress Bars */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Today's API Calls */}
          {(() => {
            const currentDailyCalls = apiUsage.dailyCalls || 0;
            const limit = apiUsage.dailyCallsLimit;
            const hasLimit = limit !== null && limit !== undefined && limit > 0;
            const pct = hasLimit ? Math.min(100, Math.round((currentDailyCalls / limit) * 100)) : 0;
            const isExceeded = hasLimit && currentDailyCalls >= limit;
            const isWarning = hasLimit && !isExceeded && pct >= 80;

            return (
              <div className={`p-3.5 rounded-2xl border transition-all ${
                isExceeded
                  ? 'bg-rose-50/60 border-rose-200'
                  : isWarning
                  ? 'bg-amber-50/60 border-amber-200'
                  : 'bg-indigo-50/40 border-indigo-100/80'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Zap className={`w-4 h-4 ${isExceeded ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-indigo-600'}`} />
                    <span className="text-xs font-bold text-slate-800">今日 API 呼叫次數</span>
                  </div>
                  <div className="text-[11px] font-bold">
                    {hasLimit ? (
                      <span className={isExceeded ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-indigo-600'}>
                        {pct}%
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal">無限制</span>
                    )}
                  </div>
                </div>

                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-xl font-black text-slate-900 tracking-tight">
                    {currentDailyCalls.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      / {hasLimit ? `${limit.toLocaleString()} 次` : '無上限'}
                    </span>
                  </div>
                  {hasLimit && (
                    <div className="text-[10px] font-medium text-slate-500">
                      {isExceeded ? (
                        <span className="text-rose-600 font-bold flex items-center gap-0.5">
                          <ShieldAlert className="w-3 h-3" /> 已達今日上限
                        </span>
                      ) : (
                        <span>剩餘 {Math.max(0, limit - currentDailyCalls).toLocaleString()} 次</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {hasLimit && (
                  <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        isExceeded ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-indigo-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Today's Tokens */}
          {(() => {
            const currentDailyTokens = apiUsage.dailyTokens || 0;
            const limit = apiUsage.dailyTokensLimit;
            const hasLimit = limit !== null && limit !== undefined && limit > 0;
            const pct = hasLimit ? Math.min(100, Math.round((currentDailyTokens / limit) * 100)) : 0;
            const isExceeded = hasLimit && currentDailyTokens >= limit;
            const isWarning = hasLimit && !isExceeded && pct >= 80;

            return (
              <div className={`p-3.5 rounded-2xl border transition-all ${
                isExceeded
                  ? 'bg-rose-50/60 border-rose-200'
                  : isWarning
                  ? 'bg-amber-50/60 border-amber-200'
                  : 'bg-purple-50/40 border-purple-100/80'
              }`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Cpu className={`w-4 h-4 ${isExceeded ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-purple-600'}`} />
                    <span className="text-xs font-bold text-slate-800">今日 Token 消耗</span>
                  </div>
                  <div className="text-[11px] font-bold">
                    {hasLimit ? (
                      <span className={isExceeded ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-purple-600'}>
                        {pct}%
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal">無限制</span>
                    )}
                  </div>
                </div>

                <div className="flex items-baseline justify-between mb-2">
                  <div className="text-xl font-black text-slate-900 tracking-tight">
                    {currentDailyTokens.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      / {hasLimit ? `${limit.toLocaleString()} tok` : '無上限'}
                    </span>
                  </div>
                  {hasLimit && (
                    <div className="text-[10px] font-medium text-slate-500">
                      {isExceeded ? (
                        <span className="text-rose-600 font-bold flex items-center gap-0.5">
                          <ShieldAlert className="w-3 h-3" /> 已達今日上限
                        </span>
                      ) : (
                        <span>剩餘 {Math.max(0, limit - currentDailyTokens).toLocaleString()} tok</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                {hasLimit && (
                  <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        isExceeded ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-purple-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Lifetime Totals & Token Breakdown Header */}
        <div className="pt-2">
          <div className="text-[11px] font-bold text-slate-500 mb-2 flex items-center justify-between">
            <span>歷史累計總消耗</span>
            <span className="text-[10px] text-slate-400 font-mono">
              計費週期起始日：{apiUsage.quotaCycleDate || '今日'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {/* Total Calls */}
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-[11px] font-bold">累計呼叫</span>
                <Zap className="w-3 h-3 text-slate-400" />
              </div>
              <div className="text-lg font-black text-slate-900 tracking-tight">
                {apiUsage.totalCalls.toLocaleString()} <span className="text-xs font-normal text-slate-500">次</span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                總發送請求數
              </div>
            </div>

            {/* Total Tokens */}
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-[11px] font-bold">累計 Token</span>
                <Cpu className="w-3 h-3 text-slate-400" />
              </div>
              <div className="text-lg font-black text-slate-900 tracking-tight">
                {apiUsage.totalTokens.toLocaleString()} <span className="text-xs font-normal text-slate-500">tok</span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                總權杖消耗量
              </div>
            </div>

            {/* Prompt Tokens */}
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-[11px] font-bold">提示詞 (輸入)</span>
                <span className="text-[10px] font-bold text-slate-400 font-mono">
                  {apiUsage.totalTokens > 0
                    ? `${Math.round((apiUsage.promptTokens / apiUsage.totalTokens) * 100)}%`
                    : '0%'}
                </span>
              </div>
              <div className="text-lg font-black text-slate-800 tracking-tight">
                {apiUsage.promptTokens.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                Prompt Tokens
              </div>
            </div>

            {/* Candidates Tokens */}
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-slate-600">
                <span className="text-[11px] font-bold">生成結果 (輸出)</span>
                <span className="text-[10px] font-bold text-slate-400 font-mono">
                  {apiUsage.totalTokens > 0
                    ? `${Math.round((apiUsage.candidatesTokens / apiUsage.totalTokens) * 100)}%`
                    : '0%'}
                </span>
              </div>
              <div className="text-lg font-black text-slate-800 tracking-tight">
                {apiUsage.candidatesTokens.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-400 font-medium">
                Output Tokens
              </div>
            </div>
          </div>
        </div>

        {/* Feature Breakdown Table / List */}
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <div className="text-[11px] font-bold text-slate-600 flex items-center justify-between">
            <span>各功能模組使用細項</span>
            {apiUsage.lastUsedAt && (
              <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" />
                最後使用：{new Date(apiUsage.lastUsedAt).toLocaleString()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {[
              {
                key: 'image_recognition',
                label: '照片 / 圖片飲食辨識',
                icon: ImageIcon,
                color: 'text-sky-600 bg-sky-50',
              },
              {
                key: 'nutrition_estimate',
                label: '文字描述營養估算',
                icon: Utensils,
                color: 'text-amber-600 bg-amber-50',
              },
              {
                key: 'barcode_ocr',
                label: '商品條碼視覺 OCR',
                icon: Barcode,
                color: 'text-emerald-600 bg-emerald-50',
              },
              {
                key: 'workout_suggest',
                label: 'AI 訓練動作推薦',
                icon: Dumbbell,
                color: 'text-rose-600 bg-rose-50',
              },
              {
                key: 'connection_test',
                label: 'API 連線測試與驗證',
                icon: RefreshCw,
                color: 'text-purple-600 bg-purple-50',
              },
            ].map((feat) => {
              const usage = apiUsage.breakdownByFeature?.[feat.key] || { calls: 0, tokens: 0 };
              const IconComponent = feat.icon;
              return (
                <div
                  key={feat.key}
                  className="p-2.5 bg-slate-50/70 border border-slate-100 rounded-xl flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${feat.color}`}>
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-bold text-slate-700 truncate">{feat.label}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-slate-800 text-[11px]">
                      {usage.calls} <span className="text-[10px] text-slate-400 font-normal">次</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {usage.tokens.toLocaleString()} tok
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Model Usage Distribution */}
        {Object.keys(apiUsage.breakdownByModel || {}).length > 0 && (
          <div className="pt-2 border-t border-slate-100 space-y-1.5">
            <div className="text-[11px] font-bold text-slate-500">模型呼叫分佈</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(apiUsage.breakdownByModel || {}).map(([modelName, mUsage]) => (
                <div
                  key={modelName}
                  className="px-2.5 py-1 bg-purple-50/60 border border-purple-100/80 rounded-lg text-[10px] font-medium text-purple-900 flex items-center gap-1.5"
                >
                  <span className="font-bold font-mono">{modelName.replace('gemini-', '')}</span>
                  <span className="text-purple-400">|</span>
                  <span>{mUsage.calls} 次</span>
                  <span className="text-purple-400">·</span>
                  <span className="font-mono">{mUsage.tokens.toLocaleString()} tok</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily Usage History Timeline */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500">
              {isAdmin ? '📊 全站每日總呼叫與總 Token 歷史' : '📊 個人每日歷史使用明細'}
            </span>
            <button
              type="button"
              onClick={fetchDailyHistory}
              disabled={loadingDailyHistory}
              className="text-[10px] font-bold text-purple-700 hover:text-purple-800 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${loadingDailyHistory ? 'animate-spin' : ''}`} />
              <span>重整歷史</span>
            </button>
          </div>

          {loadingDailyHistory && dailyHistory.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-[11px] flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>載入每日歷史中...</span>
            </div>
          ) : dailyHistory.length === 0 ? (
            <div className="p-3 text-center bg-slate-50/50 rounded-xl border border-slate-100 text-slate-400 text-[10px]">
              尚無每日歷史使用紀錄（完成 AI 呼叫後將自動寫入）
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                    <th className="px-3 py-1.5">日期</th>
                    <th className="px-3 py-1.5 text-center">呼叫次數</th>
                    <th className="px-3 py-1.5 text-right">消耗 Token</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                  {dailyHistory.map((item) => (
                    <tr key={item.date} className="hover:bg-slate-50/30 transition-colors">
                      <td className="px-3 py-1.5 font-bold text-slate-700">{item.date}</td>
                      <td className="px-3 py-1.5 text-center text-purple-700 font-black">{item.calls} 次</td>
                      <td className="px-3 py-1.5 text-right text-amber-700 font-mono">{item.tokens.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 6. Data Backup & Restore */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
        <h3 className="font-bold text-slate-900 text-sm">資料備份與還原</h3>
        <p className="text-xs text-slate-500">
          匯出所有飲食、訓練、體重與飲水資料為 JSON 或完整 HTML 報表。
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={handleExportJson}
            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>下載 JSON 備份</span>
          </button>

          <button
            type="button"
            onClick={handleExportHtml}
            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>匯出 HTML 報表</span>
          </button>

          <label className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer text-center">
            <Upload className="w-4 h-4" />
            <span>還原 JSON 檔案</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportJson}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Modals */}
      {showExportHtmlModal && (
        <ExportHtmlModal
          onClose={() => setShowExportHtmlModal(false)}
          onSuccessMessage={flashMessage}
        />
      )}

      {showCustomFoodModal && (
        <CustomFoodModal
          initialFood={editingCustomFood}
          onClose={() => {
            setShowCustomFoodModal(false);
            setEditingCustomFood(undefined);
          }}
          onSave={(food) => {
            StorageService.saveCustomFood(food);
            setCustomFoods(StorageService.getCustomFoods());
            flashMessage(`已儲存自訂飲食「${food.name}」！`);
          }}
        />
      )}

      {showCustomFoodsListModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="absolute inset-0" onClick={() => setShowCustomFoodsListModal(false)} />
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-sky-800" />
                <h3 className="text-base font-black text-slate-900">我的自訂食物清單管理</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomFoodsListModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="搜尋自訂食物名稱或品牌..."
                  value={customFoodsSearchQuery}
                  onChange={(e) => setCustomFoodsSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-sky-500 text-slate-800"
                />
              </div>
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto px-6 py-2 divide-y divide-slate-100">
              {(() => {
                const filtered = customFoods.filter((cf) => {
                  const q = customFoodsSearchQuery.toLowerCase().trim();
                  if (!q) return true;
                  return (
                    cf.name.toLowerCase().includes(q) ||
                    (cf.brand && cf.brand.toLowerCase().includes(q))
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 text-sm">
                      <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      找不到符合「{customFoodsSearchQuery}」的自訂食物
                    </div>
                  );
                }

                return filtered.map((cf) => (
                  <div key={cf.id} className="relative overflow-hidden py-1">
                    {/* Beneath Action Row */}
                    <div className="absolute inset-y-1.5 right-1 flex items-stretch gap-1 z-0">
                      <button
                        type="button"
                        onClick={() => {
                          StorageService.deleteCustomFood(cf.id);
                          const updated = StorageService.getCustomFoods();
                          setCustomFoods(updated);
                          setConfirmDeleteId(null);
                          if (updated.length === 0) {
                            setShowCustomFoodsListModal(false);
                          }
                        }}
                        className="px-3.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-xl flex items-center justify-center transition cursor-pointer"
                      >
                        確定
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl flex items-center justify-center transition cursor-pointer"
                      >
                        取消
                      </button>
                    </div>

                    {/* Sliding Card Content */}
                    <motion.div
                      animate={{ x: confirmDeleteId === cf.id ? -125 : 0 }}
                      transition={{ type: 'spring', stiffness: 580, damping: 28, mass: 0.4 }}
                      className="relative z-10 bg-white py-2 flex items-center justify-between gap-3 w-full will-change-transform transform-gpu"
                    >
                      <div className="min-w-0 flex-1">
                        {/* 1. 名稱 & 膠囊 */}
                        <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                          <span className="font-bold text-sm text-slate-800 truncate min-w-0 shrink">{cf.name}</span>
                          <div className="inline-flex items-center gap-1 shrink-0">
                            <span className="text-[10px] font-bold px-1.5 py-0.25 bg-amber-100 text-amber-800 rounded-md whitespace-nowrap shrink-0">
                              我的自訂
                            </span>
                            {(() => {
                              const isVision = cf.aiSource === 'vision' || cf.brand === 'AI 視覺辨識';
                              const isEstimation = cf.aiSource === 'estimation' || cf.brand === 'AI 智慧估算';
                              if (isVision) {
                                return (
                                  <span className="text-[10px] font-bold px-1.5 py-0.25 bg-purple-50 text-purple-700 border border-purple-100 rounded-md whitespace-nowrap shrink-0">
                                    AI 視覺辨識
                                  </span>
                                );
                              }
                              if (isEstimation) {
                                return (
                                  <span className="text-[10px] font-bold px-1.5 py-0.25 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md whitespace-nowrap shrink-0">
                                    AI 智慧估算
                                  </span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>

                        {/* 2. 品牌 */}
                        <div className="text-xs font-semibold text-slate-400 mt-0.5">
                          {cf.brand && cf.brand !== 'AI 視覺辨識' && cf.brand !== 'AI 智慧估算' ? cf.brand : (cf.aiSource ? 'AI辨識' : '自訂')}
                        </div>

                        {/* 3. 重量 熱量 */}
                        <div className="text-xs font-semibold text-sky-800 mt-1">
                          每份 ({cf.servingAmount}{cf.servingUnit}) · {cf.calories} kcal
                        </div>

                        {/* 4. 三大營養素 */}
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.25 rounded-full">C: {cf.carbs}g</span>
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.25 rounded-full">P: {cf.protein}g</span>
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.25 rounded-full">F: {cf.fat}g</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCustomFood(cf);
                            setShowCustomFoodModal(true);
                          }}
                          className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                          title="編輯"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(cf.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="刪除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  </div>
                ));
              })()}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setEditingCustomFood(undefined);
                  setShowCustomFoodModal(true);
                }}
                className="py-2 px-3.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>新增自訂食物</span>
              </button>
              
              <button
                type="button"
                onClick={() => setShowCustomFoodsListModal(false)}
                className="py-2 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Goal Setting Modal */}
      {showGoalModal && (
        <GoalSettingModal
          currentCycle={StorageService.getActiveCarbCycle()}
          presets={presets}
          onClose={() => setShowGoalModal(false)}
          onSave={(newPresets) => {
            StorageService.savePresets(newPresets);
            setPresets(newPresets);
            flashMessage('已成功儲存碳循環目標！');
          }}
        />
      )}

      {/* API Key Modal Popup */}
      {showApiKeyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 bg-purple-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2 font-black text-sm">
                <Key className="w-4 h-4 text-purple-300" />
                <span>設定 Gemini AI API 金鑰</span>
              </div>
              <button
                type="button"
                onClick={() => setShowApiKeyModal(false)}
                className="p-1.5 text-purple-200 hover:text-white rounded-xl transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs text-slate-700">
              {/* Tutorial */}
              <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl space-y-2">
                <p className="font-bold text-slate-900">📖 如何免費取得您的 Gemini API Key：</p>
                <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-relaxed">
                  <li>
                    前往官方專屬頁面：{' '}
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-600 font-bold underline hover:text-purple-800"
                    >
                      Google AI Studio API Key 取得頁面
                    </a>
                  </li>
                  <li>使用您的 Google 帳號免費登入。</li>
                  <li>點擊 <strong>「Create API key」</strong>（建立 API 金鑰），建議選擇<strong>「Create API key in new project」</strong>避免舊專案限制。</li>
                  <li>將金鑰貼至下方輸入框並點擊「儲存金鑰」即可啟用！</li>
                </ol>
                <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                  💡 <strong>重要提醒：</strong>若使用時出現「403 Permission Denied」，表示該 Google Cloud 專案已被限制或未開通 Generative Language API，請於 Google AI Studio 重新選擇「Create API key in new project」建立全新金鑰。
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">API 金鑰 (API Key)</label>
                <input
                  type="password"
                  placeholder="請貼上您的 Gemini API Key..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 font-mono text-xs focus:outline-none focus:border-purple-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  handleClearGeminiKey();
                  setShowApiKeyModal(false);
                }}
                className="py-2.5 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition cursor-pointer"
              >
                清空金鑰
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(false)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition cursor-pointer"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSaveGeminiKey(geminiKey);
                    setShowApiKeyModal(false);
                  }}
                  className="py-2.5 px-5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition cursor-pointer shadow-sm"
                >
                  儲存金鑰
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Shared Key Sync Modal */}
      {showAdminSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95">
            <div className="px-6 py-5 bg-gradient-to-r from-purple-700 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400 shrink-0" />
                <h3 className="font-bold text-sm sm:text-base">同步全域共享 AI 金鑰至雲端庫</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAdminSyncModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="flex rounded-xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => setAdminSyncTab('env')}
                  className={`flex-1 py-2 rounded-lg font-bold text-xs transition cursor-pointer ${
                    adminSyncTab === 'env' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  同步伺服器預設金鑰
                </button>
                <button
                  type="button"
                  onClick={() => setAdminSyncTab('custom')}
                  className={`flex-1 py-2 rounded-lg font-bold text-xs transition cursor-pointer ${
                    adminSyncTab === 'custom' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  輸入全新自訂金鑰
                </button>
              </div>

              {adminSyncTab === 'env' ? (
                <div className="space-y-3 bg-purple-50/60 p-4 rounded-2xl border border-purple-100 text-purple-950">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-xs">使用官方環境變數金鑰 (推薦)</p>
                      <p className="text-[11px] text-purple-800/80 mt-1 leading-relaxed">
                        自動取得伺服器內已驗證通訊正常的官方 GEMINI_API_KEY，並同步寫入雲端 Firestore 共享資料庫。全體核准的白名單使用者將能立即正常使用 AI 飲食估算與圖片辨識！
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                    請輸入由 Google AI Studio 建立的 API 金鑰。儲存前系統會先發送一個微小測試確認存取權限。
                  </div>
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700 text-xs">Gemini API Key</label>
                    <input
                      type="password"
                      placeholder="AIzaSy... 或 AQ...."
                      value={adminCustomKeyInput}
                      onChange={(e) => setAdminCustomKeyInput(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs focus:outline-none focus:border-purple-500 focus:bg-white transition"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdminSyncModal(false)}
                disabled={syncingSharedKey}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  if (adminSyncTab === 'env') {
                    handleSyncSharedGeminiKey({ syncMode: 'env' });
                  } else {
                    handleSyncSharedGeminiKey({ apiKey: adminCustomKeyInput, syncMode: 'custom' });
                  }
                }}
                disabled={syncingSharedKey || (adminSyncTab === 'custom' && !adminCustomKeyInput.trim())}
                className="py-2.5 px-5 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                {syncingSharedKey ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>驗證並同步中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{adminSyncTab === 'env' ? '立即同步伺服器金鑰' : '驗證並寫入雲端庫'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset API Usage Confirm Modal */}
      {showResetUsageConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1.5">
              <h3 className="font-bold text-slate-900 text-base">重設 API 使用量統計？</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                確定要將目前記錄的總呼叫次數（{apiUsage.totalCalls} 次）與 Token 消耗量（{apiUsage.totalTokens.toLocaleString()} tokens）歸零重新計算嗎？此操作不會影響您的 API 金鑰。
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowResetUsageConfirm(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  StorageService.resetApiUsageStats();
                  setShowResetUsageConfirm(false);
                  flashMessage('已成功重設 API 使用量與 Token 統計數據！');
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-sm shadow-rose-200"
              >
                確認歸零
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom API Quota Limits Modal */}
      {showLimitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl space-y-0 animate-in zoom-in-95 border border-slate-100">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">自訂每日 API 額度上限</h3>
                  <p className="text-[11px] text-slate-400">設定每日呼叫次數與權杖使用警示上限</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLimitModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Daily Calls Limit Section */}
              <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isCallsLimitEnabled}
                      onChange={(e) => setIsCallsLimitEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-indigo-600" />
                      每日 API 呼叫次數上限
                    </span>
                  </label>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    isCallsLimitEnabled ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {isCallsLimitEnabled ? '已啟用' : '無限制'}
                  </span>
                </div>

                {isCallsLimitEnabled && (
                  <div className="space-y-2 pt-1 animate-in fade-in">
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        step="50"
                        value={callsLimitInput}
                        onChange={(e) => setCallsLimitInput(e.target.value)}
                        placeholder="例如：1500"
                        className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 font-mono text-xs text-slate-800 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition pr-12"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        次 / 日
                      </span>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-400 font-medium">快速設定：</span>
                      {[200, 500, 1500, 3000].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCallsLimitInput(String(val))}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                            callsLimitInput === String(val)
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          {val === 1500 ? `${val} (標準)` : val}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Daily Tokens Limit Section */}
              <div className="p-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isTokensLimitEnabled}
                      onChange={(e) => setIsTokensLimitEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                    />
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-purple-600" />
                      每日 Token 消耗上限
                    </span>
                  </label>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    isTokensLimitEnabled ? 'bg-purple-100 text-purple-800' : 'bg-slate-200 text-slate-500'
                  }`}>
                    {isTokensLimitEnabled ? '已啟用' : '無限制'}
                  </span>
                </div>

                {isTokensLimitEnabled && (
                  <div className="space-y-2 pt-1 animate-in fade-in">
                    <div className="relative">
                      <input
                        type="number"
                        min="1000"
                        step="50000"
                        value={tokensLimitInput}
                        onChange={(e) => setTokensLimitInput(e.target.value)}
                        placeholder="例如：1000000"
                        className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 font-mono text-xs text-slate-800 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition pr-14"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        tok / 日
                      </span>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-slate-400 font-medium">快速設定：</span>
                      {[
                        { label: '20萬', val: 200000 },
                        { label: '50萬', val: 500000 },
                        { label: '100萬 (標準)', val: 1000000 },
                        { label: '200萬', val: 2000000 },
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setTokensLimitInput(String(item.val))}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer ${
                            tokensLimitInput === String(item.val)
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-purple-300'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Google API Reset Note */}
              <div className="p-3 bg-sky-50/70 border border-sky-100 rounded-xl flex items-start gap-2.5 text-xs text-sky-900">
                <Clock className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-bold text-[11px] text-sky-950">
                    每日自動重設機制 (Google API Quota Cycle)
                  </div>
                  <p className="text-[10px] text-sky-800/90 leading-relaxed">
                    每日太平洋時間 00:00（即本地時間 {resetInfo.formattedLocalTime}），系統會自動將今日的「已呼叫次數」與「已消耗 Token」歸零，與 Google Gemini API 伺服器額度同步。
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLimitModal(false)}
                className="py-2.5 px-4 bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveLimits}
                className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-sm shadow-indigo-200 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>儲存上限設定</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin: Add Whitelist User Modal */}
      {showAddWhitelistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl space-y-0 animate-in zoom-in-95 border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">手動新增白名單使用者</h3>
                  <p className="text-[11px] text-slate-500">授權指定 Google 帳號使用開發者共享 API 金鑰</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddWhitelistModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">使用者 Google Email 信箱 *</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="例如: friend@gmail.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">使用者暱稱 (選填)</label>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  placeholder="例如: 小明 / GymBro"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">每日呼叫上限 (次)</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={formDailyLimit}
                    onChange={(e) => setFormDailyLimit(Math.max(1, parseInt(e.target.value, 10) || 20))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-amber-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                <div className="space-y-1.5 relative">
                  <label className="text-xs font-bold text-slate-700">初始狀態</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-between cursor-pointer focus:bg-white focus:ring-2 focus:ring-amber-500/30 transition-all active:scale-[0.98]"
                    >
                      <span className="flex items-center gap-2">
                        {formStatus === 'approved' && <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />}
                        {formStatus === 'pending' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                        {formStatus === 'rejected' && <UserX className="w-3.5 h-3.5 text-rose-600" />}
                        {formStatus === 'approved' ? '已核准' : formStatus === 'pending' ? '待審核' : '已拒絕 / 停用'}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showStatusDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showStatusDropdown && (
                      <>
                        <div 
                          className="fixed inset-0 z-[60]" 
                          onClick={() => setShowStatusDropdown(false)}
                        />
                        <div className="absolute z-[70] top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-2 duration-200 ring-4 ring-black/5">
                          <button
                            type="button"
                            onClick={() => { setFormStatus('approved'); setShowStatusDropdown(false); }}
                            className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2.5 hover:bg-slate-50 transition-colors ${formStatus === 'approved' ? 'text-sky-700 bg-sky-50' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${formStatus === 'approved' ? 'bg-sky-100' : 'bg-slate-100'}`}>
                              <CheckCircle2 className="w-4 h-4 text-sky-600" />
                            </div>
                            <div className="flex flex-col">
                              <span>已核准</span>
                              <span className="text-[10px] opacity-60 font-normal">開放使用 AI 共享額度</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setFormStatus('pending'); setShowStatusDropdown(false); }}
                            className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2.5 hover:bg-slate-50 transition-colors ${formStatus === 'pending' ? 'text-amber-700 bg-amber-50' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${formStatus === 'pending' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                              <Clock className="w-4 h-4 text-amber-600" />
                            </div>
                            <div className="flex flex-col">
                              <span>待審核</span>
                              <span className="text-[10px] opacity-60 font-normal">使用者需等待開發者核准</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setFormStatus('rejected'); setShowStatusDropdown(false); }}
                            className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2.5 hover:bg-slate-50 transition-colors ${formStatus === 'rejected' ? 'text-rose-700 bg-rose-50' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${formStatus === 'rejected' ? 'bg-rose-100' : 'bg-slate-100'}`}>
                              <UserX className="w-4 h-4 text-rose-600" />
                            </div>
                            <div className="flex flex-col">
                              <span>已拒絕 / 停用</span>
                              <span className="text-[10px] opacity-60 font-normal">禁止該用戶使用共享額度</span>
                            </div>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">備註說明 (選填)</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="例如: 健身房好友、測試人員"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddWhitelistModal(false)}
                className="py-2.5 px-4 bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleCreateWhitelistUser}
                disabled={submittingAdminForm}
                className="py-2.5 px-5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{submittingAdminForm ? '儲存中...' : '確認新增'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin: Edit Whitelist User Modal */}
      {showEditWhitelistModal && selectedWhitelistUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl space-y-0 animate-in zoom-in-95 border border-slate-100">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">編輯使用者白名單與配額</h3>
                  <p className="text-[11px] text-slate-500 font-mono">{selectedWhitelistUser.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditWhitelistModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">顯示暱稱</label>
                <input
                  type="text"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">每日呼叫上限 (次)</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={formDailyLimit}
                    onChange={(e) => setFormDailyLimit(Math.max(1, parseInt(e.target.value, 10) || 20))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-purple-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                  />
                </div>

                <div className="space-y-1.5 relative">
                  <label className="text-xs font-bold text-slate-700">授權狀態</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-between cursor-pointer focus:bg-white focus:ring-2 focus:ring-purple-500/30 transition-all active:scale-[0.98]"
                    >
                      <span className="flex items-center gap-2">
                        {formStatus === 'approved' && <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" />}
                        {formStatus === 'pending' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                        {formStatus === 'rejected' && <UserX className="w-3.5 h-3.5 text-rose-600" />}
                        {formStatus === 'approved' ? '已核准' : formStatus === 'pending' ? '待審核' : '已拒絕 / 停用'}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showStatusDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showStatusDropdown && (
                      <>
                        <div 
                          className="fixed inset-0 z-[60]" 
                          onClick={() => setShowStatusDropdown(false)}
                        />
                        <div className="absolute z-[70] top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden py-1.5 animate-in fade-in slide-in-from-top-2 duration-200 ring-4 ring-black/5">
                          <button
                            type="button"
                            onClick={() => { setFormStatus('approved'); setShowStatusDropdown(false); }}
                            className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2.5 hover:bg-slate-50 transition-colors ${formStatus === 'approved' ? 'text-sky-700 bg-sky-50' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${formStatus === 'approved' ? 'bg-sky-100' : 'bg-slate-100'}`}>
                              <CheckCircle2 className="w-4 h-4 text-sky-600" />
                            </div>
                            <div className="flex flex-col">
                              <span>已核准</span>
                              <span className="text-[10px] opacity-60 font-normal">開放使用 AI 共享額度</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setFormStatus('pending'); setShowStatusDropdown(false); }}
                            className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2.5 hover:bg-slate-50 transition-colors ${formStatus === 'pending' ? 'text-amber-700 bg-amber-50' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${formStatus === 'pending' ? 'bg-amber-100' : 'bg-slate-100'}`}>
                              <Clock className="w-4 h-4 text-amber-600" />
                            </div>
                            <div className="flex flex-col">
                              <span>待審核</span>
                              <span className="text-[10px] opacity-60 font-normal">使用者需等待開發者核准</span>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => { setFormStatus('rejected'); setShowStatusDropdown(false); }}
                            className={`w-full px-4 py-2.5 text-left text-xs font-bold flex items-center gap-2.5 hover:bg-slate-50 transition-colors ${formStatus === 'rejected' ? 'text-rose-700 bg-rose-50' : 'text-slate-600 hover:text-slate-900'}`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${formStatus === 'rejected' ? 'bg-rose-100' : 'bg-slate-100'}`}>
                              <UserX className="w-4 h-4 text-rose-600" />
                            </div>
                            <div className="flex flex-col">
                              <span>已拒絕 / 停用</span>
                              <span className="text-[10px] opacity-60 font-normal">禁止該用戶使用共享額度</span>
                            </div>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">備註說明</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="例如: 核心 VIP 用戶、測試人員"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-800">
                    今日已呼叫：{selectedWhitelistUser.todayUsage || 0} 次
                  </div>
                  <div className="text-[10px] text-slate-400">勾選以立即手動重設該用戶今日調用次數為 0</div>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-purple-700">
                  <input
                    type="checkbox"
                    checked={formResetToday}
                    onChange={(e) => setFormResetToday(e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>今日歸零</span>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEditWhitelistModal(false)}
                className="py-2.5 px-4 bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveEditUser}
                disabled={submittingAdminForm}
                className="py-2.5 px-5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{submittingAdminForm ? '儲存中...' : '儲存變更'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin: Food Database Management Modal */}
      {showDatabaseFoodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-5xl w-full h-[85vh] overflow-hidden shadow-2xl flex flex-col border border-slate-100 animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <span>全站食品資料庫管理後台</span>
                    <span className="px-1.5 py-0.2 bg-sky-100 text-sky-800 rounded text-[9px] font-extrabold uppercase">
                      Database Editor
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">系統管理員可直接在線上對以下三個獨立的食品快取/公共集合進行編輯與刪除</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDatabaseFoodModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Collection Tab bar & Controls */}
            <div className="px-4 sm:px-6 py-3 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
              {/* Collection Selector Tabs - Horizontal Segmented Control */}
              <div className="grid grid-cols-3 bg-slate-100 p-1 gap-1 rounded-2xl border border-slate-200/60 w-full lg:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCollection('cloud_foods');
                    setAdminFoodSearch('');
                    fetchAdminDatabaseFoods('cloud_foods');
                  }}
                  className={`px-2 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap ${
                    selectedCollection === 'cloud_foods'
                      ? 'bg-white text-sky-700 shadow-2xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Cloud className="w-3.5 h-3.5 shrink-0" />
                  <span>網路食品</span>
                  <span className="hidden sm:inline text-[10px] opacity-70 font-normal ml-0.5">(cloud_foods)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCollection('family_foods');
                    setAdminFoodSearch('');
                    fetchAdminDatabaseFoods('family_foods');
                  }}
                  className={`px-2 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap ${
                    selectedCollection === 'family_foods'
                      ? 'bg-white text-sky-700 shadow-2xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Utensils className="w-3.5 h-3.5 shrink-0" />
                  <span>全家快取</span>
                  <span className="hidden sm:inline text-[10px] opacity-70 font-normal ml-0.5">(family_foods)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCollection('open_foods');
                    setAdminFoodSearch('');
                    fetchAdminDatabaseFoods('open_foods');
                  }}
                  className={`px-2 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer whitespace-nowrap ${
                    selectedCollection === 'open_foods'
                      ? 'bg-white text-sky-700 shadow-2xs font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                  <span>Open Foods</span>
                  <span className="hidden sm:inline text-[10px] opacity-70 font-normal ml-0.5">(open_foods)</span>
                </button>
              </div>

              {/* Search & Add Controls */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={adminFoodSearch}
                    onChange={(e) => setAdminFoodSearch(e.target.value)}
                    placeholder="搜尋食品名稱、品牌或條碼..."
                    className="w-full pl-8.5 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingAdminFood(null);
                    setEditFoodName('');
                    setEditFoodBrand(selectedCollection === 'family_foods' ? '全家' : selectedCollection === 'open_foods' ? 'Open Food Facts' : '');
                    setEditFoodCalories(100);
                    setEditFoodCarbs(10);
                    setEditFoodProtein(5);
                    setEditFoodFat(3);
                    setEditFoodSugars(2);
                    setEditFoodFiber(0);
                    setEditFoodSodium(0);
                    setEditFoodPotassium(0);
                    setEditFoodServingAmount(100);
                    setEditFoodServingUnit('g');
                    setEditFoodImageUrl('');
                    setEditFoodBarcode('');
                    setShowEditAdminFoodModal(true);
                  }}
                  className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>新增食品</span>
                </button>
              </div>
            </div>

            {/* List Table Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
              {loadingDatabaseFoods ? (
                <div className="h-full flex flex-col items-center justify-center space-y-2">
                  <RefreshCw className="w-8 h-8 text-sky-600 animate-spin" />
                  <span className="text-xs text-slate-500 font-bold">正在從 Firestore 載入食品資料...</span>
                </div>
              ) : adminDatabaseFoods.filter((food) => {
                const s = adminFoodSearch.trim().toLowerCase();
                if (!s) return true;
                return (
                  (food.name || '').toLowerCase().includes(s) ||
                  (food.brand || '').toLowerCase().includes(s) ||
                  (food.barcode || '').includes(s) ||
                  (food.id || '').toLowerCase().includes(s)
                );
              }).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-1">
                  <Database className="w-10 h-10 stroke-1" />
                  <span className="text-xs font-bold">查無符合搜尋條件的食品項目</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {adminDatabaseFoods.filter((food) => {
                    const s = adminFoodSearch.trim().toLowerCase();
                    if (!s) return true;
                    return (
                      (food.name || '').toLowerCase().includes(s) ||
                      (food.brand || '').toLowerCase().includes(s) ||
                      (food.barcode || '').includes(s) ||
                      (food.id || '').toLowerCase().includes(s)
                    );
                  }).map((food: any) => (
                    <div
                      key={food.id}
                      className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-3"
                    >
                      {/* Top row: Image + Name/Brand + Action buttons */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          {food.imageUrl ? (
                            <img
                              src={food.imageUrl}
                              alt={food.name}
                              className="w-11 h-11 object-cover rounded-xl border border-slate-100 shrink-0"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Food';
                              }}
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                              <Utensils className="w-5 h-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-800 text-sm truncate" title={food.name}>
                              {food.name}
                            </h4>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="px-1.5 py-0.2 bg-slate-100 border border-slate-200/60 rounded text-[10px] font-semibold text-slate-600 truncate max-w-[120px]">
                                {food.brand || '未提供'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold">
                                {food.servingAmount} {food.servingUnit}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Edit & Delete actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAdminFood(food);
                              setEditFoodName(food.name || '');
                              setEditFoodBrand(food.brand || '');
                              setEditFoodCalories(food.calories || 0);
                              setEditFoodCarbs(food.carbs || 0);
                              setEditFoodProtein(food.protein || 0);
                              setEditFoodFat(food.fat || 0);
                              setEditFoodSugars(food.sugars || 0);
                              setEditFoodFiber(food.fiber || 0);
                              setEditFoodSodium(food.sodium || 0);
                              setEditFoodPotassium(food.potassium || 0);
                              setEditFoodServingAmount(food.servingAmount || 100);
                              setEditFoodServingUnit(food.servingUnit || 'g');
                              setEditFoodImageUrl(food.imageUrl || '');
                              setEditFoodBarcode(food.barcode || '');
                              setShowEditAdminFoodModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                            title="編輯"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAdminFood(food.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="刪除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Middle row: Macro breakdown pill badges */}
                      <div className="grid grid-cols-4 gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-100 text-center">
                        <div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase">熱量</div>
                          <div className="text-xs font-black text-amber-600">{food.calories}<span className="text-[9px] font-normal text-amber-600/70 ml-0.5">kcal</span></div>
                        </div>
                        <div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase">碳水</div>
                          <div className="text-xs font-bold text-slate-700">{food.carbs}<span className="text-[9px] font-normal text-slate-400 ml-0.5">g</span></div>
                        </div>
                        <div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase">蛋白質</div>
                          <div className="text-xs font-bold text-emerald-600">{food.protein}<span className="text-[9px] font-normal text-emerald-600/70 ml-0.5">g</span></div>
                        </div>
                        <div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase">脂肪</div>
                          <div className="text-xs font-bold text-blue-600">{food.fat}<span className="text-[9px] font-normal text-blue-600/70 ml-0.5">g</span></div>
                        </div>
                      </div>

                      {/* Bottom row: Barcode / Document ID tag */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                        <span className="font-mono truncate max-w-[200px]" title={food.barcode || food.id}>
                          {food.barcode ? `🏷️ 條碼: ${food.barcode}` : `🆔 ID: ${food.id}`}
                        </span>
                        {food.sugars > 0 && (
                          <span className="text-amber-500 font-medium">糖 {food.sugars}g</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-bold">
                目前載入: {adminDatabaseFoods.filter((food) => {
                  const s = adminFoodSearch.trim().toLowerCase();
                  if (!s) return true;
                  return (
                    (food.name || '').toLowerCase().includes(s) ||
                    (food.brand || '').toLowerCase().includes(s) ||
                    (food.barcode || '').includes(s) ||
                    (food.id || '').toLowerCase().includes(s)
                  );
                }).length} 項食品 (上限 300 項)
              </span>
              <button
                type="button"
                onClick={() => setShowDatabaseFoodModal(false)}
                className="py-1.5 px-4 bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin: Edit / Add Food Modal */}
      {showEditAdminFoodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col border border-slate-100 animate-in zoom-in-95">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  {editingAdminFood ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    {editingAdminFood ? `編輯食品：${editingAdminFood.name}` : '手動新增食品'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    目標資料庫: <span className="font-bold text-sky-600 uppercase font-mono">{selectedCollection}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditAdminFoodModal(false);
                  setEditingAdminFood(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form */}
            <form onSubmit={handleSaveAdminFood} className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[70vh]">
              {/* Basic Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5 col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">食品名稱 *</label>
                    <button
                      type="button"
                      onClick={() => setShowAiCameraModalForAdmin(true)}
                      disabled={isAiAnalyzingAdminFood}
                      className="text-[11px] font-bold text-indigo-700 hover:text-indigo-800 flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-lg transition cursor-pointer disabled:opacity-50 shadow-2xs"
                      title="拍攝食品包裝或營養標示照片，由 AI 自動辨識並填入"
                    >
                      {isAiAnalyzingAdminFood ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      )}
                      <span>{isAiAnalyzingAdminFood ? (aiAnalysisAdminStatus || 'AI辨識中...') : '✨ AI 智慧拍照辨識'}</span>
                    </button>
                  </div>
                  {isAiAnalyzingAdminFood && aiAnalysisAdminProgress > 0 && (
                    <div className="w-full bg-indigo-50 border border-indigo-100 p-2 rounded-xl flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-[10px] font-bold text-indigo-900 mb-1">
                          <span>{aiAnalysisAdminStatus}</span>
                          <span>{aiAnalysisAdminProgress}%</span>
                        </div>
                        <div className="w-full bg-indigo-200/60 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-600 h-full transition-all duration-300 rounded-full"
                            style={{ width: `${aiAnalysisAdminProgress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <input
                    type="text"
                    required
                    value={editFoodName}
                    onChange={(e) => setEditFoodName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    placeholder="請輸入食品或食品包裝上的名稱"
                  />
                </div>

                <div className="space-y-1.5 col-span-2">
                  <label className="text-xs font-bold text-slate-700">品牌 / 來源</label>
                  <input
                    type="text"
                    value={editFoodBrand}
                    onChange={(e) => setEditFoodBrand(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    placeholder="例如: 統一超商, 全家, 麥當勞"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      { key: '7-11', label: '7-11' },
                      { key: '全家', label: '全家' },
                      { key: '萊爾富', label: '萊爾富' },
                      { key: 'OK', label: 'OK' },
                      { key: '自煮', label: '自煮' },
                      { key: '自訂', label: '自訂' },
                    ].map((b) => (
                      <button
                        key={b.key}
                        type="button"
                        onClick={() => setEditFoodBrand(b.key)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-medium border transition cursor-pointer ${
                          editFoodBrand === b.key
                            ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">國際條碼 (選填)</label>
                    <button
                      type="button"
                      onClick={() => setShowBarcodeScannerForAdmin(true)}
                      className="text-[11px] font-bold text-sky-600 hover:text-sky-700 flex items-center gap-1 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg transition cursor-pointer"
                      title="使用相機掃描條碼"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>掃描條碼</span>
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={editFoodBarcode}
                      onChange={(e) => setEditFoodBarcode(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30 pr-10"
                      placeholder="輸入商品 EAN 條碼"
                    />
                    <button
                      type="button"
                      onClick={() => setShowBarcodeScannerForAdmin(true)}
                      className="absolute right-2.5 p-1 text-slate-400 hover:text-sky-600 rounded-lg transition cursor-pointer"
                      title="開啟條碼掃描"
                    >
                      <Barcode className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Serving specifications */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-200/50">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">基準份量數值</label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    value={editFoodServingAmount}
                    onChange={(e) => setEditFoodServingAmount(Number(e.target.value) || 100)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">基準份量單位</label>
                  <input
                    type="text"
                    value={editFoodServingUnit}
                    onChange={(e) => setEditFoodServingUnit(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    placeholder="g, ml, 顆, 包"
                  />
                </div>
              </div>

              {/* Macros (Grams & energy) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                  <h4 className="text-xs font-bold text-slate-500">核心營養成分 (每一基準份量)</h4>
                  <button
                    type="button"
                    onClick={() => {
                      const calc = Math.round((Number(editFoodCarbs) * 4 + Number(editFoodProtein) * 4 + Number(editFoodFat) * 9) * 10) / 10;
                      setEditFoodCalories(calc);
                      flashMessage('✨ 已依三大營養素自動換算熱量');
                    }}
                    className="text-xs font-semibold text-sky-700 hover:text-sky-800 flex items-center gap-1 cursor-pointer bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    依三大營養素自動換算熱量
                  </button>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">熱量 (kcal)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editFoodCalories}
                      onChange={(e) => setEditFoodCalories(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-amber-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">碳水 (g)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editFoodCarbs}
                      onChange={(e) => setEditFoodCarbs(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">蛋白質 (g)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editFoodProtein}
                      onChange={(e) => setEditFoodProtein(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-emerald-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">脂肪 (g)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editFoodFat}
                      onChange={(e) => setEditFoodFat(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                </div>

                <MacroCalorieVerifier
                  calories={Number(editFoodCalories) || 0}
                  carbs={Number(editFoodCarbs) || 0}
                  protein={Number(editFoodProtein) || 0}
                  fat={Number(editFoodFat) || 0}
                  onApplyCalculated={(val) => setEditFoodCalories(val)}
                />
              </div>

              {/* Sub-nutrition (Sugar, Fiber, Sodium, Potassium) */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 border-b border-slate-100 pb-1">微量元素 / 其他成分 (每一基準份量)</h4>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">糖 (g)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editFoodSugars}
                      onChange={(e) => setEditFoodSugars(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">膳食纖維 (g)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editFoodFiber}
                      onChange={(e) => setEditFoodFiber(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">鈉 (mg)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editFoodSodium}
                      onChange={(e) => setEditFoodSodium(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-600">鉀 (mg)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={editFoodPotassium}
                      onChange={(e) => setEditFoodPotassium(Number(e.target.value) || 0)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                    />
                  </div>
                </div>
              </div>

              {/* Image URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">食品圖片 URL</label>
                <input
                  type="url"
                  value={editFoodImageUrl}
                  onChange={(e) => setEditFoodImageUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/30"
                  placeholder="請輸入食品網路圖片連結 (https://...)"
                />
              </div>
            </form>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowEditAdminFoodModal(false);
                  setEditingAdminFood(null);
                }}
                className="py-2.5 px-4 bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveAdminFood}
                className="py-2.5 px-5 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>確認儲存</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {showBarcodeScannerForAdmin && (
        <BarcodeScannerModal
          isOpen={showBarcodeScannerForAdmin}
          onClose={() => setShowBarcodeScannerForAdmin(false)}
          onDetected={(code) => {
            setEditFoodBarcode(code);
            setShowBarcodeScannerForAdmin(false);
            flashMessage(`成功掃描條碼：${code}`);
          }}
        />
      )}

      {showAiCameraModalForAdmin && (
        <AiCameraModal
          isOpen={showAiCameraModalForAdmin}
          onClose={() => setShowAiCameraModalForAdmin(false)}
          onCaptured={(base64, mimeType) => {
            setShowAiCameraModalForAdmin(false);
            handleAdminAiImageCaptured(base64, mimeType);
          }}
        />
      )}
    </div>
  );
};
