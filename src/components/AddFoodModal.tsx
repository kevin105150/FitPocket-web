import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Search,
  Plus,
  Camera,
  Sparkles,
  Barcode,
  Store,
  ChefHat,
  BookmarkCheck,
  Globe,
  Loader2,
  AlertCircle,
  Upload,
  ChevronDown,
  Cloud,
} from 'lucide-react';
import { CustomFood, FoodSearchResult, MealType } from '../types';
import { StorageService } from '../services/storage';
import { CloudFoodService } from '../services/cloudFoodService';
import { optimizeImageForAi } from '../utils/imageOptimizer';
import { checkAiKeyOrWarn } from '../utils/aiHelper';

interface AddFoodModalProps {
  initialMealType: MealType;
  availableMeals: { type: MealType; name: string }[];
  currentDate: string;
  initialTab?: FoodTab;
  onClose: () => void;
  onSelectFood: (food: FoodSearchResult, mealType?: MealType) => void;
  onOpenCustomFoodModal: () => void;
}

export type FoodTab = 'ALL' | 'OFFICIAL' | 'CUSTOM' | 'CLOUD' | 'AI_SCAN' | 'BARCODE';

export const AddFoodModal: React.FC<AddFoodModalProps> = ({
  initialMealType,
  availableMeals,
  initialTab = 'ALL',
  onClose,
  onSelectFood,
  onOpenCustomFoodModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FoodTab>(initialTab);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(initialMealType);
  const [showMealSelector, setShowMealSelector] = useState(false);

  const selectedMealName = availableMeals.find(m => m.type === selectedMealType)?.name || '餐點';

  // AI Scanner state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiStatus, setAiStatus] = useState('');
  const [aiError, setAiError] = useState('');
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [lastImageMimeType, setLastImageMimeType] = useState<string>('image/jpeg');
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Barcode state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeError, setBarcodeError] = useState('');

  // Online Open Food Facts search state
  const [isOnlineSearching, setIsOnlineSearching] = useState(false);
  const [onlineResults, setOnlineResults] = useState<FoodSearchResult[]>([]);

  // Cloud foods state
  const [cloudFoods, setCloudFoods] = useState<FoodSearchResult[]>([]);
  const [isCloudLoading, setIsCloudLoading] = useState(false);

  // Fetch cloud foods from Firestore
  const loadCloudFoods = async (queryStr: string = '') => {
    setIsCloudLoading(true);
    try {
      const results = await CloudFoodService.fetchCloudFoods(queryStr);
      setCloudFoods(results);
    } catch (e) {
      console.warn('Error loading cloud foods:', e);
    } finally {
      setIsCloudLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'CLOUD') {
      loadCloudFoods(searchQuery);
    }
  }, [activeTab, searchQuery]);

  // Get local presets + custom foods
  const allLocalFoods = useMemo(() => {
    return StorageService.searchFoods('');
  }, []);

  // Filter foods by tab and query
  const filteredFoods = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = allLocalFoods;

    if (activeTab === 'OFFICIAL') {
      list = list.filter(
        (f) =>
          f.brand?.includes('衛福部') ||
          f.brand?.includes('官方') ||
          f.brand?.includes('台灣') ||
          f.id.startsWith('tfda_')
      );
    } else if (activeTab === 'CUSTOM') {
      list = list.filter((f) => f.isUserCustom);
    }

    if (!q) return list;

    return list.filter((item) => {
      const matchName = item.name.toLowerCase().includes(q);
      const matchBrand = item.brand?.toLowerCase().includes(q);
      const matchBarcode = item.barcode && item.barcode.includes(q);
      return matchName || matchBrand || matchBarcode;
    });
  }, [allLocalFoods, activeTab, searchQuery]);

  // Handle Online OpenFoodFacts Search
  const handleSearchOnline = async () => {
    if (!searchQuery.trim()) return;
    setIsOnlineSearching(true);
    try {
      const res = await fetch(
        `/api/openfoodfacts/search?q=${encodeURIComponent(searchQuery.trim())}`
      );
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.products || []).map((p: any) => {
          const defaultAmount = p.defaultServingAmount || 100;
          const ratio = defaultAmount / 100;
          return {
            id: p.id,
            name: p.name,
            brand: p.brand || '一般食材',
            calories: Math.round(p.caloriesPer100g * ratio * 10) / 10,
            carbs: Math.round(p.carbsPer100g * ratio * 10) / 10,
            sugars: Math.round((p.sugarsPer100g || 0) * ratio * 10) / 10,
            fiber: Math.round((p.fiberPer100g || 0) * ratio * 10) / 10,
            protein: Math.round(p.proteinPer100g * ratio * 10) / 10,
            fat: Math.round(p.fatPer100g * ratio * 10) / 10,
            sodium: Math.round((p.sodiumPer100g || 0) * ratio * 10) / 10,
            potassium: Math.round((p.potassiumPer100g || 0) * ratio * 10) / 10,
            servingAmount: defaultAmount,
            servingUnit: p.servingUnit || 'g',
            servingSizeText: p.servingSizeText,
            imageUrl: p.imageUrl,
            barcode: p.barcode,
          };
        });
        setOnlineResults(mapped);
      }
    } catch (e) {
      console.error('Online search failed:', e);
    } finally {
      setIsOnlineSearching(false);
    }
  };

  // Handle Barcode lookup
  const handleBarcodeLookup = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBarcodeLoading(true);
    setBarcodeError('');
    try {
      // First check in local database
      const localMatch = allLocalFoods.find((f) => f.barcode === trimmed);
      if (localMatch) {
        onSelectFood(localMatch);
        return;
      }

      // Then check OpenFoodFacts proxy
      const res = await fetch(`/api/openfoodfacts/barcode/${encodeURIComponent(trimmed)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.product) {
          const p = data.product;
          const defaultAmount = p.defaultServingAmount || 100;
          const ratio = defaultAmount / 100;
          const mapped: FoodSearchResult = {
            id: p.id,
            name: p.name,
            brand: p.brand || '一般食材',
            calories: Math.round(p.caloriesPer100g * ratio * 10) / 10,
            carbs: Math.round(p.carbsPer100g * ratio * 10) / 10,
            sugars: Math.round((p.sugarsPer100g || 0) * ratio * 10) / 10,
            fiber: Math.round((p.fiberPer100g || 0) * ratio * 10) / 10,
            protein: Math.round(p.proteinPer100g * ratio * 10) / 10,
            fat: Math.round(p.fatPer100g * ratio * 10) / 10,
            sodium: Math.round((p.sodiumPer100g || 0) * ratio * 10) / 10,
            potassium: Math.round((p.potassiumPer100g || 0) * ratio * 10) / 10,
            servingAmount: defaultAmount,
            servingUnit: p.servingUnit || 'g',
            servingSizeText: p.servingSizeText,
            imageUrl: p.imageUrl,
            barcode: p.barcode,
          };
          onSelectFood(mapped);
          return;
        }
      }
      setBarcodeError(`查無此商品條碼 (${trimmed})，請嘗試手動搜尋或以 AI 分析。`);
    } catch (e: any) {
      setBarcodeError('條碼查詢異常，請檢查網路連線。');
    } finally {
      setBarcodeLoading(false);
    }
  };

  // Separate AI call logic for reusability (Retries)
  const performImageAnalysis = async (base64: string, mime: string) => {
    setAiLoading(true);
    setAiError('');
    setAiProgress(10);
    setAiStatus('正在初始化 AI 辨識系統...');

    try {
      setAiProgress(25);
      setAiStatus('正在優化圖片以加快辨識速度...');

      // 核心優化：在前端先壓縮圖片，大幅縮減上傳時間
      const optimizedBase64 = await optimizeImageForAi(base64);

      const userKey = StorageService.getGeminiApiKey();
      const model = StorageService.getSelectedAiModel();
      
      setAiProgress(40);
      setAiStatus('正在將資料傳送至 Gemini AI 雲端分析...');

      const res = await fetch('/api/ai/estimate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: optimizedBase64, // 使用優化後的 base64
          mimeType: 'image/jpeg', // 壓縮後已統一格式為 jpeg
          customApiKey: userKey,
          model,
        }),
      });

      setAiProgress(75);
      setAiStatus('AI 營養師正在辨識食材並計算營養素...');

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const isBusy = res.status === 503 || res.status === 429;
        const msg = isBusy 
          ? 'AI 伺服器目前較為繁忙，請稍候重試或再點擊一次「再試一次」按鈕。' 
          : (errData.error || '照片辨識失敗');
        throw new Error(msg);
      }

      setAiProgress(90);
      setAiStatus('正在整理辨識結果...');

      const result = await res.json();
      const defaultAmount = Number(result.defaultServingAmount) || 200;
      const ratio = defaultAmount / 100;
      const calories = Math.round((Number(result.caloriesPer100g) || 150) * ratio * 10) / 10;
      const carbs = Math.round((Number(result.carbsPer100g) || 15) * ratio * 10) / 10;
      const protein = Math.round((Number(result.proteinPer100g) || 10) * ratio * 10) / 10;
      const fat = Math.round((Number(result.fatPer100g) || 5) * ratio * 10) / 10;
      const sugars = Math.round((Number(result.sugarsPer100g) || 0) * ratio * 10) / 10;
      const fiber = Math.round((Number(result.fiberPer100g) || 0) * ratio * 10) / 10;
      const sodium = Math.round((Number(result.sodiumPer100g) || 0) * ratio * 10) / 10;
      const potassium = Math.round((Number(result.potassiumPer100g) || 0) * ratio * 10) / 10;

      // Extract and normalize brand (e.g. 7-11, 全家, 萊爾富, OK) and barcode
      const rawBrand = result.brand ? String(result.brand).trim() : '';
      const normalizedBrand = rawBrand ? CloudFoodService.normalizeBrand(rawBrand) : '';
      const detectedBarcode = result.barcode ? String(result.barcode).trim() : undefined;

      const foodItem: FoodSearchResult = {
        id: 'ai_photo_' + Date.now(),
        name: result.name || '相片辨識料理',
        brand: normalizedBrand,
        barcode: detectedBarcode,
        calories,
        carbs,
        protein,
        fat,
        sugars,
        fiber,
        sodium,
        potassium,
        servingAmount: defaultAmount,
        servingUnit: result.servingUnit || 'g',
        servingSizeText: result.servingSizeText || `1份 (${defaultAmount}${result.servingUnit || 'g'})`,
        isUserCustom: true,
        aiSource: 'vision',
      };

      onSelectFood(foodItem);
    } catch (e: any) {
      setAiError(e.message || 'AI 辨識發生錯誤');
      setRetryAction(() => () => performImageAnalysis(base64, mime));
    } finally {
      setAiLoading(false);
    }
  };

  // Handle AI text analyze
  const handleAiTextAnalyze = async () => {
    if (!checkAiKeyOrWarn()) return;
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError('');
    setAiProgress(20);
    setAiStatus('正在解析您的文字描述...');
    setRetryAction(() => handleAiTextAnalyze);
    try {
      const userKey = StorageService.getGeminiApiKey();
      const model = StorageService.getSelectedAiModel();
      
      setAiProgress(50);
      setAiStatus('正在由 AI 營養師估算熱量與三大營養素...');
      
      const res = await fetch('/api/ai/estimate-nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: aiPrompt.trim(), 
          customApiKey: userKey,
          model 
        }),
      });

      setAiProgress(85);
      setAiStatus('正在生成營養成分清單...');

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const isBusy = res.status === 503 || res.status === 429;
        const msg = isBusy 
          ? 'AI 伺服器目前較為繁忙，請稍候重試或點擊「再試一次」。' 
          : (errData.error || '估算失敗');
        throw new Error(msg);
      }

      const result = await res.json();
      const defaultAmount = Number(result.defaultServingAmount) || 100;
      const ratio = defaultAmount / 100;
      const calories = Math.round((Number(result.caloriesPer100g) || 150) * ratio * 10) / 10;
      const carbs = Math.round((Number(result.carbsPer100g) || 15) * ratio * 10) / 10;
      const protein = Math.round((Number(result.proteinPer100g) || 10) * ratio * 10) / 10;
      const fat = Math.round((Number(result.fatPer100g) || 5) * ratio * 10) / 10;
      const sugars = Math.round((Number(result.sugarsPer100g) || 0) * ratio * 10) / 10;
      const fiber = Math.round((Number(result.fiberPer100g) || 0) * ratio * 10) / 10;
      const sodium = Math.round((Number(result.sodiumPer100g) || 0) * ratio * 10) / 10;
      const potassium = Math.round((Number(result.potassiumPer100g) || 0) * ratio * 10) / 10;

      const foodItem: FoodSearchResult = {
        id: 'ai_' + Date.now(),
        name: result.name || aiPrompt.trim(),
        brand: '',
        calories,
        carbs,
        protein,
        fat,
        sugars,
        fiber,
        sodium,
        potassium,
        servingAmount: defaultAmount,
        servingUnit: result.servingUnit || 'g',
        servingSizeText: result.servingSizeText || `1份 (${defaultAmount}${result.servingUnit || 'g'})`,
        isUserCustom: true,
        aiSource: 'estimation',
      };

      onSelectFood(foodItem);
    } catch (e: any) {
      setAiError(e.message || 'AI 辨識發生錯誤，請重試');
    } finally {
      setAiLoading(false);
    }
  };

  // Handle Photo Upload and Gemini Multimodal Analyze
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!checkAiKeyOrWarn()) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const mime = file.type || 'image/jpeg';
    setLastImageMimeType(mime);

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setSelectedImageBase64(base64);
      await performImageAnalysis(base64, mime);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white w-full max-w-2xl h-[92vh] sm:h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="relative">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">記錄飲食</h2>
              <button
                onClick={() => setShowMealSelector(!showMealSelector)}
                className="px-2.5 py-0.5 rounded-full bg-sky-100 text-sky-800 text-xs font-bold flex items-center gap-1 hover:bg-sky-200 transition cursor-pointer"
              >
                {selectedMealName}
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
            
            {showMealSelector && (
              <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 p-2 min-w-[120px] animate-in fade-in slide-in-from-top-1">
                {availableMeals.map((m) => (
                  <button
                    key={m.type}
                    onClick={() => {
                      setSelectedMealType(m.type);
                      setShowMealSelector(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition ${
                      selectedMealType === m.type
                        ? 'bg-sky-600 text-white'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Mode Toggle */}
        <div className="p-4 border-b border-slate-100 flex gap-2">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer ${
              activeTab === 'ALL' || activeTab === 'OFFICIAL' || activeTab === 'CUSTOM' || activeTab === 'CLOUD'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            一般搜尋
          </button>
          <button
            onClick={() => {
              if (!checkAiKeyOrWarn()) return;
              setActiveTab('AI_SCAN');
            }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer ${
              activeTab === 'AI_SCAN' || activeTab === 'BARCODE'
                ? 'bg-purple-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            AI 智慧辨識/工具
          </button>
        </div>

        {/* Conditional Search/Tool Bar */}
        {(activeTab === 'ALL' || activeTab === 'OFFICIAL' || activeTab === 'CUSTOM' || activeTab === 'CLOUD') && (
          <div className="px-4 pt-3 pb-2">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder={activeTab === 'CLOUD' ? '搜尋公共網路食品資料庫...' : '搜尋衛福部官方資料庫或自訂飲食...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-slate-100/80 rounded-2xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-sky-600 focus:bg-white border border-transparent focus:border-sky-200 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* Categories Bar (Only in general search) */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-none pt-2">
              <button onClick={() => setActiveTab('ALL')} className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${activeTab === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>全部</button>
              <button onClick={() => setActiveTab('OFFICIAL')} className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${activeTab === 'OFFICIAL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>衛福部資料庫</button>
              <button onClick={() => setActiveTab('CUSTOM')} className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${activeTab === 'CUSTOM' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>自訂</button>
              <button onClick={() => setActiveTab('CLOUD')} className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${activeTab === 'CLOUD' ? 'bg-sky-600 text-white shadow-xs' : 'bg-sky-50 text-sky-700 hover:bg-sky-100'}`}>
                <Cloud className="w-3.5 h-3.5" />
                網路擴充庫
              </button>
            </div>
          </div>
        )}

        {/* Smart Tool Switcher (Only in AI mode) */}
        {(activeTab === 'AI_SCAN' || activeTab === 'BARCODE') && (
          <div className="p-4 border-b border-slate-100 flex gap-2">
            <button
              onClick={() => setActiveTab('AI_SCAN')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${activeTab === 'AI_SCAN' ? 'bg-purple-100 text-purple-800' : 'text-slate-500'}`}
            >
              AI 影像/文字分析
            </button>
            <button
              onClick={() => setActiveTab('BARCODE')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer ${activeTab === 'BARCODE' ? 'bg-blue-100 text-blue-800' : 'text-slate-500'}`}
            >
              條碼搜尋
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* TAB: AI SCAN */}
          {activeTab === 'AI_SCAN' && (
            <div className="space-y-4 max-w-md mx-auto py-2">
              <div className="bg-purple-50 border border-purple-200/80 rounded-2xl p-4 text-purple-900">
                <div className="flex items-center gap-2 font-bold text-sm mb-1">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  Gemini AI 飲食辨識與分析
                </div>
                <p className="text-xs text-purple-700 leading-relaxed">
                  拍攝餐點照片或輸入食物描述（如「雞肉沙拉佐胡麻醬」、「排骨便當半碗飯」），AI
                  將直接估算精準三大營養素與熱量！
                </p>
              </div>

              {/* Photo upload section */}
              <div className="bg-white border-2 border-dashed border-purple-200 rounded-2xl p-5 text-center hover:border-purple-400 transition">
                <input
                  type="file"
                  ref={cameraInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <input
                  type="file"
                  ref={galleryInputRef}
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                
                {selectedImageBase64 ? (
                  <div className="mb-3 relative inline-block">
                    <img
                      src={selectedImageBase64}
                      alt="辨識照片預覽"
                      className="w-32 h-32 object-cover rounded-2xl border border-purple-200 shadow-sm mx-auto"
                    />
                  </div>
                ) : (
                  <Camera className="w-10 h-10 mx-auto text-purple-500 mb-2" />
                )}

                <h4 className="font-bold text-sm text-slate-800">
                  {selectedImageBase64 ? '已選擇照片，準備進行 AI 辨識' : '拍照或上傳餐點照片'}
                </h4>
                <p className="text-xs text-slate-500 mt-1 mb-4">支援相機即時拍攝、相簿照片 (JPG, PNG)</p>
                
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={aiLoading}
                    className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    手機相機拍照
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={aiLoading}
                    className="px-4 py-2.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4 text-purple-600" />
                    從相簿選擇
                  </button>
                </div>
              </div>

              {/* Or text describe */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  或輸入食物名稱 / 外食描述
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="例如: 摩斯藜麥燒肉珍珠堡、超商烤雞便當"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAiTextAnalyze()}
                    className="flex-1 px-3 py-2 bg-white rounded-xl border border-slate-200 text-sm focus:outline-purple-600"
                  />
                  <button
                    type="button"
                    onClick={handleAiTextAnalyze}
                    disabled={aiLoading || !aiPrompt.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'AI 估算'}
                  </button>
                </div>
              </div>

              {aiLoading && (
                <div className="py-6 px-4 bg-purple-50/50 rounded-2xl border border-purple-100 text-center space-y-4">
                  <div className="relative">
                    <Loader2 className="w-10 h-10 animate-spin text-purple-600 mx-auto opacity-20" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-purple-600 animate-pulse" />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black text-purple-700 uppercase tracking-wider px-1">
                      <span>{aiStatus}</span>
                      <span>{aiProgress}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-purple-100 rounded-full overflow-hidden shadow-inner">
                      <div 
                        className="h-full bg-linear-to-r from-purple-500 to-indigo-600 transition-all duration-500 ease-out shadow-sm"
                        style={{ width: `${aiProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium">
                      AI 辨識可能需要 5-15 秒，具體時間取決於網路與圖片複雜度
                    </p>
                  </div>
                </div>
              )}

              {aiError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{aiError}</span>
                  </div>
                  {retryAction && (
                    <button
                      onClick={() => retryAction()}
                      className="ml-6 px-3 py-1.5 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition cursor-pointer"
                    >
                      再試一次
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB: BARCODE */}
          {activeTab === 'BARCODE' && (
            <div className="space-y-4 max-w-md mx-auto py-2">
              <div className="bg-blue-50 border border-blue-200/80 rounded-2xl p-4 text-blue-900">
                <div className="flex items-center gap-2 font-bold text-sm mb-1">
                  <Barcode className="w-4 h-4 text-blue-600" />
                  條碼即時查詢 (EAN-13 / UPC)
                </div>
                <p className="text-xs text-blue-700 leading-relaxed">
                  輸入包裝上的 13 碼商品條碼，自動檢索在地超商與 Open Food Facts 全球食品資料庫。
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">商品條碼號碼</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="例如: 4710088195001"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleBarcodeLookup(barcodeInput)}
                    className="flex-1 px-3 py-2 bg-white rounded-xl border border-slate-200 text-sm font-mono focus:outline-blue-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleBarcodeLookup(barcodeInput)}
                    disabled={barcodeLoading || !barcodeInput.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {barcodeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '查詢條碼'}
                  </button>
                </div>
              </div>

              {barcodeLoading && (
                <div className="py-6 text-center space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                  <p className="text-xs font-medium text-blue-800">正在比對食品條碼資料庫...</p>
                </div>
              )}

              {barcodeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{barcodeError}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB: CLOUD */}
          {activeTab === 'CLOUD' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-gradient-to-r from-sky-600 to-blue-700 rounded-2xl text-white shadow-sm flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <Cloud className="w-4 h-4 text-sky-200" />
                    公共網路食品資料庫
                  </div>
                  <p className="text-xs text-sky-100 mt-0.5">
                    彙整線上擴充食品與特殊餐點的營養與熱量標示
                  </p>
                </div>
                <button
                  onClick={onOpenCustomFoodModal}
                  className="px-3 py-1.5 bg-white text-sky-800 hover:bg-sky-50 font-bold text-xs rounded-xl shadow-xs shrink-0 transition cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  新增上傳
                </button>
              </div>

              {isCloudLoading ? (
                <div className="py-12 text-center space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin text-sky-600 mx-auto" />
                  <p className="text-xs font-medium text-slate-500">正在讀取網路食品資料庫...</p>
                </div>
              ) : cloudFoods.length > 0 ? (
                cloudFoods.map((food) => (
                  <div
                    key={food.id}
                    onClick={() => onSelectFood(food, selectedMealType)}
                    className="p-3 bg-white border border-slate-200 hover:border-sky-400 rounded-2xl hover:shadow-sm transition cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      {/* 1. 名稱 & 膠囊 */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-bold text-sm text-slate-900 truncate group-hover:text-sky-800">
                          {food.name}
                        </h4>
                        <span className="text-[10px] font-bold px-1.5 py-0.25 bg-sky-100 text-sky-800 rounded-md shrink-0 flex items-center gap-0.5">
                          <Cloud className="w-2.5 h-2.5 text-sky-600" />
                          網路資料庫
                        </span>
                      </div>

                      {/* 2. 品牌 */}
                      <div className="text-xs font-semibold text-slate-400 mt-0.5">
                        {food.brand || '一般食材'}
                      </div>

                      {/* 3. 重量 熱量 三大營養素 */}
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                        <span className="font-semibold text-sky-800">
                          每份 ({food.servingAmount}{food.servingUnit}) · {food.calories} kcal
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.25 rounded-full">C: {food.carbs}g</span>
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.25 rounded-full">P: {food.protein}g</span>
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.25 rounded-full">F: {food.fat}g</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-2 text-slate-400 group-hover:text-sky-600 group-hover:bg-sky-50 rounded-xl transition">
                      <Plus className="w-5 h-5" />
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-sm font-medium text-slate-600">目前網路資料庫尚無符合的食品</p>
                  <p className="text-xs text-slate-400">您可以手動新增並同步上傳擴充資料庫！</p>
                  <button
                    type="button"
                    onClick={onOpenCustomFoodModal}
                    className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 transition inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    新增自訂食品
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB: ALL, 7-11, FAMILYMART, OFFICIAL, CUSTOM */}
          {activeTab !== 'AI_SCAN' && activeTab !== 'BARCODE' && activeTab !== 'CLOUD' && (
            <div className="space-y-2">
              {filteredFoods.length > 0 ? (
                filteredFoods.map((food) => (
                    <div key={food.id} onClick={() => onSelectFood(food, selectedMealType)} className="p-3 bg-white border border-slate-100 hover:border-sky-300 rounded-2xl hover:shadow-sm transition cursor-pointer flex items-center justify-between gap-3 group">
                      <div className="min-w-0 flex-1">
                        {/* 1. 名稱 & 膠囊 */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-sm text-slate-900 truncate group-hover:text-sky-800">
                            {food.name}
                          </h4>
                          {food.isUserCustom && (
                            <span className="text-[10px] font-bold px-1.5 py-0.25 bg-amber-100 text-amber-800 rounded-md shrink-0">
                              我的自訂
                            </span>
                          )}
                          {food.id.startsWith('cloud_') && (
                            <span className="text-[10px] font-bold px-1.5 py-0.25 bg-sky-100 text-sky-800 rounded-md shrink-0">
                              網路資料庫
                            </span>
                          )}
                          {(food.aiSource === 'vision' || food.brand === 'AI 視覺辨識') && (
                            <span className="text-[10px] font-bold px-1.5 py-0.25 bg-purple-50 text-purple-700 border border-purple-100 rounded-md shrink-0">
                              AI 視覺辨識
                            </span>
                          )}
                          {(food.aiSource === 'estimation' || food.brand === 'AI 智慧估算') && (
                            <span className="text-[10px] font-bold px-1.5 py-0.25 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md shrink-0">
                              AI 智慧估算
                            </span>
                          )}
                        </div>

                        {/* 2. 品牌 */}
                        <div className="text-xs font-semibold text-slate-400 mt-0.5">
                          {(() => {
                            const isVision = food.aiSource === 'vision' || food.brand === 'AI 視覺辨識';
                            const isEstimation = food.aiSource === 'estimation' || food.brand === 'AI 智慧估算';
                            if (isVision || isEstimation) return '一般食材';
                            return food.brand || '一般食材';
                          })()}
                        </div>

                        {/* 3. 重量 熱量 三大營養素 */}
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                          <span className="font-semibold text-sky-800">
                            每份 ({food.servingAmount}{food.servingUnit}) · {food.calories} kcal
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.25 rounded-full">C: {food.carbs}g</span>
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.25 rounded-full">P: {food.protein}g</span>
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.25 rounded-full">F: {food.fat}g</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-2 text-slate-400 group-hover:text-sky-700 group-hover:bg-sky-50 rounded-xl transition">
                        <Plus className="w-5 h-5" />
                      </div>
                    </div>
                ))
              ) : (
                <div className="py-8 text-center space-y-3">
                  <p className="text-sm text-slate-500">找不到相符的本地食物項目</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleSearchOnline}
                      disabled={isOnlineSearching}
                      className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-900 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {isOnlineSearching ? '正在雲端搜尋...' : '在 Open Food Facts 搜尋'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('AI_SCAN');
                        setAiPrompt(searchQuery);
                      }}
                      className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-semibold hover:bg-purple-700 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      使用 Gemini AI 估算
                    </button>
                  </div>
                </div>
              )}

              {/* Online search results if any */}
              {onlineResults.length > 0 && (
                <div className="pt-4 border-t border-slate-200 mt-4 space-y-2">
                  <div className="text-xs font-bold text-slate-500">Open Food Facts 網路搜尋結果</div>
                  {onlineResults.map((food) => (
                    <div
                      key={food.id}
                      onClick={() => onSelectFood(food)}
                      className="p-3 bg-blue-50/50 border border-blue-100 rounded-2xl hover:border-blue-300 transition cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        {/* 1. 名稱 & 膠囊 */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-sm text-slate-800 truncate group-hover:text-blue-900">
                            {food.name}
                          </h4>
                          <span className="text-[10px] font-bold px-1.5 py-0.25 bg-blue-100 text-blue-800 rounded-md shrink-0">
                            全球資料庫
                          </span>
                        </div>

                        {/* 2. 品牌 */}
                        <div className="text-xs font-semibold text-slate-400 mt-0.5">
                          {food.brand || '一般食材'}
                        </div>

                        {/* 3. 重量 熱量 三大營養素 */}
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                          <span className="font-semibold text-blue-900">
                            每份 ({food.servingAmount}{food.servingUnit}) · {food.calories} kcal
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.25 rounded-full">C: {food.carbs}g</span>
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.25 rounded-full">P: {food.protein}g</span>
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.25 rounded-full">F: {food.fat}g</span>
                          </div>
                        </div>
                      </div>
                      <Plus className="w-5 h-5 text-blue-600 shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with "+ 建立自訂飲食" button */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onOpenCustomFoodModal}
            className="flex items-center gap-1.5 text-xs font-bold text-sky-800 hover:text-sky-950 px-3 py-2 rounded-xl hover:bg-sky-100 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            自行建立自訂飲食
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-800 px-3 py-2 cursor-pointer font-medium"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};
