import React, { useState, useEffect } from 'react';
import { getTodayString } from '../utils/dateUtils';
import {
  Settings,
  Calculator,
  Flame,
  Utensils,
  Database,
  Download,
  Upload,
  Key,
  Smartphone,
  Check,
  Plus,
  Trash2,
  Edit2,
  Sparkles,
  ChevronRight,
  FileText,
} from 'lucide-react';
import {
  CarbCycleType,
  CustomFood,
  MealConfig,
  NutritionGoalPreset,
  UserProfile,
} from '../types';
import { StorageService } from '../services/storage';
import { GoalSettingModal } from './GoalSettingModal';
import { CustomFoodModal } from './CustomFoodModal';
import { ApkDownloadModal } from './ApkDownloadModal';

export const SettingsScreen: React.FC = () => {
  const [userProfile, setUserProfile] = useState<UserProfile>(
    StorageService.getUserProfile()
  );
  const [activeMeals, setActiveMeals] = useState<MealConfig[]>(
    StorageService.getActiveMeals()
  );
  const [customFoods, setCustomFoods] = useState<CustomFood[]>(
    StorageService.getCustomFoods()
  );
  const [geminiKey, setGeminiKey] = useState<string>(
    StorageService.getGeminiApiKey()
  );
  const [presets, setPresets] = useState<Record<CarbCycleType, NutritionGoalPreset>>(
    StorageService.getPresets()
  );

  // Modals
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showCustomFoodModal, setShowCustomFoodModal] = useState(false);
  const [editingCustomFood, setEditingCustomFood] = useState<CustomFood | undefined>(
    undefined
  );
  const [showApkModal, setShowApkModal] = useState(false);

  // New meal input
  const [newMealName, setNewMealName] = useState('');
  const [editingMealIndex, setEditingMealIndex] = useState<number | null>(null);
  const [editMealText, setEditMealText] = useState('');

  // Save feedback state
  const [savedMessage, setSavedMessage] = useState('');

  const flashMessage = (msg: string) => {
    setSavedMessage(msg);
    setTimeout(() => setSavedMessage(''), 3000);
  };

  // Profile calculations
  const calculateBmrTdee = () => {
    const { gender, age, heightCm, currentWeightKg, activityLevel, fitnessGoal } =
      userProfile;

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
    const { targetCal, targetProtein, targetFat, targetCarbs } = calculated;

    const newPresets: Record<CarbCycleType, NutritionGoalPreset> = {
      ...presets,
      MEDIUM: {
        type: 'MEDIUM',
        calories: targetCal,
        carbs: targetCarbs,
        protein: targetProtein,
        fat: targetFat,
        sodium: 2400,
        potassium: 2500,
      },
      HIGH: {
        type: 'HIGH',
        calories: targetCal + 300,
        carbs: targetCarbs + 60,
        protein: targetProtein,
        fat: Math.max(35, targetFat - 5),
        sodium: 2400,
        potassium: 2500,
      },
      LOW: {
        type: 'LOW',
        calories: targetCal - 300,
        carbs: Math.max(50, targetCarbs - 60),
        protein: targetProtein + 10,
        fat: targetFat + 5,
        sodium: 2400,
        potassium: 2500,
      },
      CUSTOM: {
        type: 'CUSTOM',
        calories: targetCal,
        carbs: targetCarbs,
        protein: targetProtein,
        fat: targetFat,
        sodium: 2400,
        potassium: 2500,
      },
    };

    setPresets(newPresets);
    StorageService.savePresets(newPresets);
    flashMessage('已成功將計算之營養數據套用至高、中、低碳循環目標！');
  };

  // Save profile
  const handleSaveProfile = (newProf: UserProfile) => {
    setUserProfile(newProf);
    StorageService.saveUserProfile(newProf);
    flashMessage('個人基本身體資料已更新！');
  };

  // Add custom meal
  const handleAddMeal = () => {
    if (!newMealName.trim()) return;
    if (activeMeals.length >= 10) {
      alert('最多支援 10 個餐點項目');
      return;
    }
    const nextIdx = activeMeals.length + 1;
    const mealType = ('MEAL_' + nextIdx) as any;
    const updated = [
      ...activeMeals,
      { mealType, customName: newMealName.trim(), isCustom: true },
    ];
    setActiveMeals(updated);
    StorageService.saveActiveMeals(updated);
    setNewMealName('');
    flashMessage(`已新增餐點「${newMealName.trim()}」！`);
  };

  // Delete custom meal
  const handleDeleteMeal = (index: number) => {
    const meal = activeMeals[index];
    if (!meal.isCustom) {
      alert('預設餐點無法刪除');
      return;
    }
    const updated = activeMeals.filter((_, i) => i !== index);
    setActiveMeals(updated);
    StorageService.saveActiveMeals(updated);
  };

  // Save Gemini Key
  const handleSaveGeminiKey = (key: string) => {
    setGeminiKey(key);
    StorageService.saveGeminiApiKey(key);
    flashMessage('Gemini API 設定已儲存！');
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
    const records = StorageService.getAllFoodRecords();
    const workouts = StorageService.getAllWorkoutRecords();
    const htmlContent = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="utf-8">
<title>FitPocket 飲食與訓練備份報表</title>
<style>
body { font-family: -apple-system, sans-serif; padding: 24px; color: #1e293b; background: #f8fafc; }
h1 { color: #15803d; }
table { width: 100%; border-collapse: collapse; margin-top: 16px; background: #fff; border-radius: 8px; overflow: hidden; }
th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; font-size: 13px; }
th { background: #f1f5f9; font-weight: 600; }
</style>
</head>
<body>
<h1>FitPocket 歷史紀錄報告</h1>
<p>匯出時間：${new Date().toLocaleString()}</p>
<h2>每日飲食記錄 (${records.length} 筆)</h2>
<table>
<thead><tr><th>日期</th><th>餐點</th><th>食物</th><th>份量</th><th>熱量</th><th>碳水</th><th>蛋白</th><th>脂肪</th></tr></thead>
<tbody>
${records
  .map(
    (r) =>
      `<tr><td>${r.date}</td><td>${r.mealType}</td><td>${r.name}</td><td>${r.amount}${r.unit}</td><td>${r.calories}</td><td>${r.carbs}g</td><td>${r.protein}g</td><td>${r.fat}g</td></tr>`
  )
  .join('')}
</tbody>
</table>
<h2>訓練紀錄 (${workouts.length} 筆)</h2>
<table>
<thead><tr><th>日期</th><th>部位</th><th>動作數量</th></tr></thead>
<tbody>
${workouts
  .map(
    (w) =>
      `<tr><td>${w.date}</td><td>${w.bodyPart}</td><td>${w.exercises.length}</td></tr>`
  )
  .join('')}
</tbody>
</table>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html; charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitpocket_report_${getTodayString()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-slate-500 mb-1 font-semibold">生理性別</label>
            <select
              value={userProfile.gender}
              onChange={(e) =>
                handleSaveProfile({
                  ...userProfile,
                  gender: e.target.value as any,
                })
              }
              className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-bold"
            >
              <option value="male">男性 (Male)</option>
              <option value="female">女性 (Female)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-500 mb-1 font-semibold">年齡</label>
            <input
              type="number"
              value={userProfile.age}
              onChange={(e) =>
                handleSaveProfile({
                  ...userProfile,
                  age: parseInt(e.target.value) || 20,
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
                  heightCm: parseFloat(e.target.value) || 170,
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
                  currentWeightKg: parseFloat(e.target.value) || 70,
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
                  targetWeightKg: parseFloat(e.target.value) || 65,
                })
              }
              className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-bold"
            />
          </div>

          <div>
            <label className="block text-slate-500 mb-1 font-semibold">活動強度</label>
            <select
              value={userProfile.activityLevel}
              onChange={(e) =>
                handleSaveProfile({
                  ...userProfile,
                  activityLevel: e.target.value as any,
                })
              }
              className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 font-bold"
            >
              <option value="sedentary">久坐無運動 (×1.2)</option>
              <option value="light">輕度運動 1-3天 (×1.375)</option>
              <option value="moderate">中度運動 3-5天 (×1.55)</option>
              <option value="heavy">重度運動 6-7天 (×1.725)</option>
              <option value="athlete">運動員密集高強度 (×1.9)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-slate-500 mb-1 font-semibold text-xs">健身與飲食目標</label>
          <div className="grid grid-cols-3 gap-2">
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
                className={`py-2 px-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
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

          <div className="flex items-center justify-between pt-2 border-t border-emerald-200/50 text-xs">
            <div className="text-slate-600">
              建議分配：碳 <strong className="text-amber-800">{calculated.targetCarbs}g</strong> ·
              蛋 <strong className="text-blue-800">{calculated.targetProtein}g</strong> · 脂{' '}
              <strong className="text-rose-800">{calculated.targetFat}g</strong>
            </div>

            <button
              type="button"
              onClick={handleApplyCalculatedToGoals}
              className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1"
            >
              <Sparkles className="w-3.5 h-3.5" />
              一鍵套用至循環日
            </button>
          </div>
        </div>
      </div>

      {/* 2. Carb Cycle Goals Button */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">碳循環各日目標設定</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            自訂高碳日、中碳日、低碳日與自訂日的熱量、三大營養素與微量鈉鉀上限
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowGoalModal(true)}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1"
        >
          <span>詳細微調</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 3. Meal Customization */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Utensils className="w-4 h-4 text-emerald-700" />
            <h3 className="font-bold text-slate-900 text-sm">自訂餐點時段</h3>
          </div>
          <span className="text-xs text-slate-400">目前 {activeMeals.length} 個餐點</span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {activeMeals.map((m, idx) => (
            <div key={m.mealType} className="py-2 flex items-center justify-between">
              {editingMealIndex === idx ? (
                <div className="flex items-center gap-2 flex-1 mr-2">
                  <input
                    type="text"
                    value={editMealText}
                    onChange={(e) => setEditMealText(e.target.value)}
                    className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (editMealText.trim()) {
                        const updated = [...activeMeals];
                        updated[idx].customName = editMealText.trim();
                        setActiveMeals(updated);
                        StorageService.saveActiveMeals(updated);
                        setEditingMealIndex(null);
                      }
                    }}
                    className="px-2 py-1 bg-emerald-800 text-white rounded-lg text-[11px] font-bold"
                  >
                    儲存
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800">{m.customName}</span>
                  {m.isCustom && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                      自訂
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditingMealIndex(idx);
                    setEditMealText(m.customName);
                  }}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded"
                  title="重新命名"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                {m.isCustom && (
                  <button
                    type="button"
                    onClick={() => handleDeleteMeal(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded"
                    title="刪除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add Meal form */}
        <div className="pt-2 flex gap-2">
          <input
            type="text"
            placeholder="新增餐點 (例如: 練前加餐、宵夜)"
            value={newMealName}
            onChange={(e) => setNewMealName(e.target.value)}
            className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
          />
          <button
            type="button"
            onClick={handleAddMeal}
            className="px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-xl hover:bg-slate-900 transition flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            新增
          </button>
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="p-2.5 bg-slate-50 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-semibold">台灣官方與超商預載</span>
            <span className="font-bold text-slate-800 text-sm">{presetFoodCount} 筆</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-semibold">我的常用自訂</span>
            <span className="font-bold text-emerald-800 text-sm">{customFoods.length} 筆</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-semibold">Open Food Facts</span>
            <span className="font-bold text-sky-800 text-sm">全球雲端</span>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-xl">
            <span className="text-[10px] text-slate-400 block font-semibold">Gemini AI 分析</span>
            <span className="font-bold text-purple-800 text-sm">2.5 Flash</span>
          </div>
        </div>

        {customFoods.length > 0 && (
          <div className="pt-2">
            <div className="text-xs font-bold text-slate-500 mb-1.5">我的自訂食物清單：</div>
            <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 text-xs">
              {customFoods.map((cf) => (
                <div key={cf.id} className="py-2 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800">{cf.name}</span>
                    <span className="text-[11px] text-slate-400 ml-2">
                      {cf.caloriesPer100g} kcal / 100g
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCustomFood(cf);
                        setShowCustomFoodModal(true);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-700"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        StorageService.deleteCustomFood(cf.id);
                        setCustomFoods(StorageService.getCustomFoods());
                      }}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 5. Gemini API Key Configuration */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-2xs space-y-3">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-purple-600" />
          <h3 className="font-bold text-slate-900 text-sm">Gemini AI API 金鑰設定</h3>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          系統已內建後端伺服器代理，支援照片與描述飲食分析。若您有自己的 Google AI Studio
          金鑰，可填寫於此以使用您的專屬配額。
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            placeholder="AIzaSy..."
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            className="flex-1 px-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 font-mono"
          />
          <button
            type="button"
            onClick={() => handleSaveGeminiKey(geminiKey)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            儲存金鑰
          </button>
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

      {/* 7. Native Android APK Download Portal CTA */}
      <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white rounded-3xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <Smartphone className="w-6 h-6 text-emerald-400" />
          <div>
            <h3 className="font-bold text-sm">FitPocket 原生 Android APK</h3>
            <p className="text-xs text-slate-300">
              提供 8 區段高速串流下載通道，支援手機離線使用與純本機儲存
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => setShowApkModal(true)}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>開啟 APK 下載器</span>
          </button>
          <a
            href="/apk.html"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl transition flex items-center justify-center"
          >
            獨立頁面
          </a>
        </div>
      </div>

      {/* Modals */}
      {showGoalModal && (
        <GoalSettingModal
          currentCycle="MEDIUM"
          presets={presets}
          onClose={() => setShowGoalModal(false)}
          onSave={(newPresets) => {
            setPresets(newPresets);
            StorageService.savePresets(newPresets);
            flashMessage('碳循環目標已儲存！');
          }}
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

      {showApkModal && (
        <ApkDownloadModal isOpen={showApkModal} onClose={() => setShowApkModal(false)} />
      )}
    </div>
  );
};
