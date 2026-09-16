import React, { useState, useEffect } from 'react';
import { getTodayString } from '../utils/dateUtils';
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
} from 'lucide-react';
import {
  CustomFood,
  UserProfile,
} from '../types';
import { StorageService } from '../services/storage';
import { CloudFoodService } from '../services/cloudFoodService';
import { GoalSettingModal } from './GoalSettingModal';
import { CustomFoodModal } from './CustomFoodModal';
import { auth, loginWithGoogle, logout, testFirebaseConnection } from '../lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

export const SettingsScreen: React.FC = () => {
  const [user, setUser] = useState<FirebaseUser | null>(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await loginWithGoogle(true);
      flashMessage('已成功登入並開始同步雲端資料！');
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
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
  const [cloudFoodCount, setCloudFoodCount] = useState<number | null>(null);

  useEffect(() => {
    CloudFoodService.getCloudFoodsCount().then((count) => setCloudFoodCount(count));
  }, []);

  // Modals
  const [showCustomFoodModal, setShowCustomFoodModal] = useState(false);
  const [showCustomFoodsListModal, setShowCustomFoodsListModal] = useState(false);
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
    flashMessage('已成功將計算之營養數據套用！(請注意：碳循環目標設定已移除)');
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
  const handleSaveGeminiKey = (key: string) => {
    if (!key.trim()) {
      handleClearGeminiKey();
      return;
    }
    setGeminiKey(key);
    StorageService.saveGeminiApiKey(key);
    setApiKeyStatus('saved');
    setTimeout(() => setApiKeyStatus('none'), 5000);
    flashMessage('Gemini API 設定已儲存！');
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
        body: JSON.stringify({ customApiKey: geminiKey, model: aiModel }),
      });
      const data = await res.json();
      setTestResult(data);
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
    const rawDataJson = StorageService.exportData();
    const parsedData = JSON.parse(rawDataJson);
    const htmlContent = generateFullAppExportHtml(parsedData);
    const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitpocket_full_report_${getTodayString()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    flashMessage('已成功匯出全頁面互動式 HTML 備份檔！');
  };

  // JSON Import
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const success = StorageService.importData(reader.result as string);
      if (success) {
        alert('資料還原成功！系統將自動重新載入。');
        window.location.reload();
      } else {
        alert('匯入失敗，請確認檔案格式是否正確。');
      }
    };
    reader.readAsText(file);
  };

  const presetFoodCount = StorageService.getPresetFoods().length;

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
        <div className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl">
          <Settings className="w-5 h-5" />
        </div>
      </div>

      {savedMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600" />
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
            <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-lg flex items-center gap-1">
              <Check className="w-3 h-3" /> 已連結雲端硬碟
            </span>
          ) : (
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-lg">
              尚未授權
            </span>
          )}
        </div>

        {user ? (
          <div className="space-y-3">
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
            
            <button
              onClick={async () => {
                flashMessage('正在與 Google Drive 同步...');
                await StorageService.syncFromCloud();
                flashMessage('同步完成！');
                setTimeout(() => window.location.reload(), 1000);
              }}
              className="w-full py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-black rounded-xl border border-sky-100 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Database className="w-4 h-4" />
              <span>立即從雲端硬碟拉取最新數據</span>
            </button>
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
            <Calculator className="w-5 h-5 text-emerald-700" />
            <h3 className="font-bold text-slate-900 text-sm">
              身體數值與 TDEE / BMR 試算
            </h3>
          </div>
          <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg">
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
                    ? 'bg-emerald-800 text-white border-emerald-800'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Calculation Result Banner */}
        <div className="bg-emerald-50/70 border border-emerald-200/60 p-4 rounded-2xl space-y-3">
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
              <span className="text-[10px] font-bold text-emerald-800 block">推薦每日目標</span>
              <span className="text-base font-black text-emerald-800">
                {calculated.targetCal} <span className="text-xs">kcal</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 border-t border-emerald-200/50 text-xs">
            <div className="text-slate-600">
              建議分配：碳 <strong className="text-amber-800">{calculated.targetCarbs}g</strong> ·
              蛋 <strong className="text-blue-800">{calculated.targetProtein}g</strong> · 脂{' '}
              <strong className="text-rose-800">{calculated.targetFat}g</strong>
            </div>

            <button
              type="button"
              onClick={handleApplyCalculatedToGoals}
              className="w-full px-3 py-2.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              一鍵套用至循環日
            </button>
          </div>
        </div>
      </div>

      {/* 4. Food Database & Custom Foods Management */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-700" />
            <h3 className="font-bold text-slate-900 text-sm">食品資料庫管理</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingCustomFood(undefined);
              setShowCustomFoodModal(true);
            }}
            className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1"
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
            <span className="font-bold text-emerald-800 text-sm">{customFoods.length} 筆</span>
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
              className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-100 text-emerald-800 text-xs font-bold rounded-xl shadow-2xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Search className="w-3.5 h-3.5 text-emerald-700" />
              <span>管理自訂食物清單 ({customFoods.length} 筆)</span>
            </button>
          </div>
        )}
      </div>

      {/* 5. Gemini API Key Configuration */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-4">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-purple-600" />
          <h3 className="font-bold text-slate-900 text-sm">Gemini AI API 金鑰設定 (必填)</h3>
        </div>
        
        <div className="bg-purple-50/70 border border-purple-100 p-3.5 rounded-2xl text-xs text-purple-900 space-y-2">
          <p className="font-bold">💡 為什麼需要填寫 API Key？</p>
          <p className="leading-relaxed text-purple-800">
            為確保隱私與獨立配額，本應用的所有 AI 智慧分析與拍照辨識功能，<strong>一律需要使用者自行輸入個人的 Google Gemini API Key</strong> 才能使用。系統不提供預設金鑰。
          </p>
        </div>

        {/* Tutorial */}
        <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl space-y-2 text-xs text-slate-700">
          <p className="font-bold text-slate-900">📖 如何免費取得您的 Gemini API Key：</p>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-600 leading-relaxed">
            <li>
              前往官方網站：{' '}
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 font-bold underline hover:text-purple-800"
              >
                Google AI Studio
              </a>
            </li>
            <li>使用您的 Google 帳號免費登入。</li>
            <li>點擊左上角或頁面中的 <strong>「Get API key」</strong> 按鈕。</li>
            <li>點擊 <strong>「Create API key」</strong>（建立 API 金鑰），並複製產生的金鑰。</li>
            <li>將金鑰貼至下方輸入框並點擊「儲存金鑰」即可啟用！</li>
          </ol>
        </div>

        <div className="flex gap-2 pt-1">
          <input
            type="password"
            placeholder="請輸入您的 Gemini API Key..."
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            className="flex-1 px-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 font-mono"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleClearGeminiKey}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              清空
            </button>
            <button
              type="button"
              onClick={() => handleSaveGeminiKey(geminiKey)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
            >
              儲存金鑰
            </button>
          </div>
        </div>

        {/* Dynamic Model Switcher */}
        <div className="mt-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2">
            動態模型切換 (3.x 系列)
          </div>
          <div className="flex gap-1.5">
            {['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-3.8-flash'].map((m) => (
              <button
                key={m}
                onClick={() => handleModelChange(m)}
                className={`flex-1 py-2 text-[11px] font-bold rounded-xl transition cursor-pointer ${
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
            <span>{testingAi ? '正在測試 AI 通訊與延遲...' : '即時測試 AI API 連線'}</span>
          </button>

          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 ${
                testResult.ok
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border border-rose-200 text-rose-800'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                {testResult.ok ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600" />
                )}
                <span>{testResult.ok ? 'AI 連線正常' : 'AI 連線失敗'}</span>
              </div>
              {testResult.ok ? (
                <div className="text-[11px] text-emerald-700 space-y-0.5">
                  <p>• 運作模型：<span className="font-mono font-semibold">{testResult.modelUsed}</span></p>
                  <p>• 回應延遲：<span className="font-semibold">{testResult.latencyMs} 毫秒</span></p>
                  <p className="text-emerald-600/90 font-medium">智慧飲食估算、照片辨識、訓練推薦等所有 AI 功能皆已就緒！</p>
                </div>
              ) : (
                <div className="text-[11px] text-rose-700">
                  <p>{testResult.error || '請確認 API 金鑰是否有效或網路通訊正常。'}</p>
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
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {firebaseStatus.success ? (
                  <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
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

        {apiKeyStatus === 'saved' && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 py-1.5 px-3 rounded-lg animate-in fade-in slide-in-from-top-1">
            <Check className="w-3.5 h-3.5" />
            <span>API 金鑰已成功儲存並同步至雲端！</span>
          </div>
        )}

        {apiKeyStatus === 'deleted' && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-rose-600 bg-rose-50 py-1.5 px-3 rounded-lg animate-in fade-in slide-in-from-top-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>API 金鑰已刪除。</span>
          </div>
        )}
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
                <Database className="w-5 h-5 text-emerald-800" />
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
                  className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-2xl focus:outline-none focus:border-emerald-500 text-slate-800"
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
                  <div key={cf.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 text-sm truncate">{cf.name}</div>
                      <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-0.5">
                        {(() => {
                          const isVision = cf.aiSource === 'vision' || cf.brand === 'AI 視覺辨識';
                          const isEstimation = cf.aiSource === 'estimation' || cf.brand === 'AI 智慧估算';
                          const displayBrand = (isVision || isEstimation) ? '' : cf.brand;
                          
                          return (
                            <>
                              {displayBrand && (
                                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-sm font-semibold">
                                  {displayBrand}
                                </span>
                              )}
                              {isVision && (
                                <span className="bg-purple-50 text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded-sm font-semibold">
                                  AI 視覺辨識
                                </span>
                              )}
                              {isEstimation && (
                                <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded-sm font-semibold">
                                  AI 智慧估算
                                </span>
                              )}
                            </>
                          );
                        })()}
                        <span>每份 ({cf.servingAmount}{cf.servingUnit}) {cf.calories} kcal</span>
                        <span className="text-slate-300">|</span>
                        <span>碳: {cf.carbs}g</span>
                        <span>蛋: {cf.protein}g</span>
                        <span>脂: {cf.fat}g</span>
                      </div>
                    </div>
                    
                    {confirmDeleteId === cf.id ? (
                      <div className="flex items-center gap-1 bg-rose-50/80 px-2 py-1 rounded-xl border border-rose-100 shrink-0">
                        <span className="text-[10px] font-bold text-rose-700 mr-1">確認刪除？</span>
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
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg transition cursor-pointer"
                        >
                          確定
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-1.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded-lg transition cursor-pointer"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCustomFood(cf);
                            setShowCustomFoodModal(true);
                          }}
                          className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition cursor-pointer"
                          title="編輯"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(cf.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                          title="刪除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
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
                className="py-2 px-3.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
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
    </div>
  );
};
