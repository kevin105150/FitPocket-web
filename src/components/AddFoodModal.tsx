import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Search,
  Plus,
  Pencil,
  Check,
  Camera,
  Sparkles,
  Barcode,
  ChefHat,
  BookmarkCheck,
  Globe,
  Loader2,
  AlertCircle,
  Upload,
  ChevronDown,
  Cloud,
  History,
  Clock,
  Store,
} from 'lucide-react';
import { CustomFood, FoodSearchResult, MealType, FoodRecord } from '../types';
import { StorageService } from '../services/storage';
import { CloudFoodService } from '../services/cloudFoodService';
import { OpenFoodService } from '../services/openFoodService';
import { FamilyCacheService } from '../services/familyCacheService';
import { BatchCrawlModal } from './BatchCrawlModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { AiCameraModal } from './AiCameraModal';
import { optimizeImageForAi } from '../utils/imageOptimizer';
import { checkAiKeyOrWarn } from '../utils/aiHelper';
import { getTodayString } from '../utils/dateUtils';

interface AddFoodModalProps {
  initialMealType: MealType;
  availableMeals: { type: MealType; name: string }[];
  currentDate: string;
  initialTab?: FoodTab;
  onClose: () => void;
  onSelectFood: (food: FoodSearchResult, mealType?: MealType) => void;
  onFastAddFood?: (food: FoodSearchResult, mealType?: MealType) => void;
  onOpenCustomFoodModal: (prefilledBarcode?: string) => void;
}

export type FoodTab = 'ALL' | 'OPEN_FOOD' | 'OFFICIAL' | 'CUSTOM' | 'CLOUD' | 'AI_SCAN' | 'BARCODE' | 'FAMILY';

export const AddFoodModal: React.FC<AddFoodModalProps> = ({
  initialMealType,
  availableMeals,
  currentDate = getTodayString(),
  initialTab = 'ALL',
  onClose,
  onSelectFood,
  onFastAddFood,
  onOpenCustomFoodModal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FoodTab>(initialTab);
  const [selectedMealType, setSelectedMealType] = useState<MealType>(initialMealType);
  const [showMealSelector, setShowMealSelector] = useState(false);

  // Fast add animation & feedback
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({});
  const [fastAddNotice, setFastAddNotice] = useState<string | null>(null);

  // History state & scroll ref
  const [historyRecords, setHistoryRecords] = useState<FoodRecord[]>([]);
  const [animatingHistoryId, setAnimatingHistoryId] = useState<string | null>(null);
  const contentBodyRef = useRef<HTMLDivElement>(null);

  const loadHistoryRecords = () => {
    const recent = StorageService.getRecentFoodHistory(selectedMealType, 7);
    setHistoryRecords(recent);
  };

  useEffect(() => {
    loadHistoryRecords();
  }, [selectedMealType]);

  const mapRecordToSearchResult = (r: FoodRecord): FoodSearchResult => {
    // 1. Try to find original custom food
    const customFoods = StorageService.getCustomFoods();
    const custom = customFoods.find(
      (c) => c.id === r.sourceFoodId || (c.name === r.name && c.brand === r.brand)
    );
    if (custom) {
      return {
        id: custom.id,
        name: custom.name,
        brand: custom.brand,
        barcode: custom.barcode || r.barcode,
        calories: custom.calories,
        carbs: custom.carbs,
        protein: custom.protein,
        fat: custom.fat,
        sugars: custom.sugars || 0,
        fiber: custom.fiber || 0,
        sodium: custom.sodium || 0,
        potassium: custom.potassium || 0,
        servingAmount: custom.servingAmount,
        servingUnit: custom.servingUnit,
        aiSource: custom.aiSource || r.aiSource,
        isUserCustom: true,
        lastLoggedAmount: r.loggedAmount,
      };
    }

    // 2. Try to find original preset food
    const presetFoods = StorageService.getPresetFoods();
    const preset = presetFoods.find(
      (p) => p.id === r.sourceFoodId || p.name === r.name
    );
    if (preset) {
      return {
        ...preset,
        id: preset.id,
        aiSource: r.aiSource,
        lastLoggedAmount: r.loggedAmount,
      };
    }

    // 3. Check if record has explicit base serving fields
    if (r.baseServingAmount && r.baseCalories !== undefined && r.baseServingAmount > 0) {
      return {
        id: r.sourceFoodId || r.id,
        name: r.name,
        brand: r.brand || '自訂',
        barcode: r.barcode,
        calories: r.baseCalories,
        carbs: r.baseCarbs ?? r.carbs,
        protein: r.baseProtein ?? r.protein,
        fat: r.baseFat ?? r.fat,
        sugars: r.baseSugars ?? r.sugars ?? 0,
        fiber: r.baseFiber ?? r.fiber ?? 0,
        sodium: r.baseSodium ?? r.sodium ?? 0,
        potassium: r.basePotassium ?? r.potassium ?? 0,
        servingAmount: r.baseServingAmount,
        servingUnit: r.baseServingUnit || r.loggedUnit || 'g',
        aiSource: r.aiSource,
        lastLoggedAmount: r.loggedAmount,
      };
    }

    // 4. Default fallback: calculate base values if loggedAmount > 0
    const logged = r.loggedAmount || 100;
    const isTfda = r.sourceFoodId?.startsWith('tfda_') || r.id?.startsWith('tfda_') || (r.brand || '').includes('衛福部');
    const unit = r.baseServingUnit || r.loggedUnit || 'g';
    const isSingleUnit = ['份', '個', '顆', '碗', '包', '片', '盤', '杯', '罐', '支', '塊', '條', '盒'].includes(unit);
    const baseServing = isTfda ? 100 : isSingleUnit ? 1 : (r.baseServingAmount || 100);
    const ratio = logged > 0 ? baseServing / logged : 1;

    return {
      id: r.sourceFoodId || r.id,
      name: r.name,
      brand: r.brand || '自訂',
      barcode: r.barcode,
      calories: Math.round((r.calories || 0) * ratio * 10) / 10,
      carbs: Math.round((r.carbs || 0) * ratio * 10) / 10,
      protein: Math.round((r.protein || 0) * ratio * 10) / 10,
      fat: Math.round((r.fat || 0) * ratio * 10) / 10,
      sugars: Math.round((r.sugars || 0) * ratio * 10) / 10,
      fiber: Math.round((r.fiber || 0) * ratio * 10) / 10,
      sodium: Math.round((r.sodium || 0) * ratio * 10) / 10,
      potassium: Math.round((r.potassium || 0) * ratio * 10) / 10,
      servingAmount: baseServing,
      servingUnit: unit,
      aiSource: r.aiSource,
      lastLoggedAmount: r.loggedAmount,
    };
  };

  const formatHistoryTime = (timestamp: number): string => {
    if (!timestamp) return '過去紀錄';
    const now = Date.now();
    const diffHours = (now - timestamp) / (1000 * 60 * 60);
    if (diffHours < 24) {
      const d = new Date(timestamp);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `今天 ${hh}:${mm}`;
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return '昨天';
    return `${diffDays}天前`;
  };

  const handleQuickAddHistory = async (record: FoodRecord) => {
    // 1. Trigger Checkmark Animation immediately
    setAnimatingHistoryId(record.id);

    // 2. Short wait before re-order
    await new Promise((resolve) => setTimeout(resolve, 150));

    // 3. Delegate ONLY to onFastAddFood / onSelectFood to prevent double insertion!
    const searchItem = mapRecordToSearchResult(record);
    if (onFastAddFood) {
      onFastAddFood(searchItem, selectedMealType);
    } else {
      onSelectFood(searchItem, selectedMealType);
    }

    // 4. Reload history list -> updates order & moves item to top (Index 0), replacing the original
    const updated = StorageService.getRecentFoodHistory(selectedMealType, 7);
    setHistoryRecords(updated);
    const newTopId = updated[0]?.id;
    setAddedIds((prev) => ({ ...prev, [record.id]: true, ...(newTopId ? { [newTopId]: true } : {}) }));
    setFastAddNotice(`已快速新增「${record.name}」！`);

    // 5. Scroll container smoothly to top (Position 0)
    if (contentBodyRef.current) {
      contentBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }

    setTimeout(() => {
      setAddedIds((prev) => ({
        ...prev,
        [record.id]: false,
        ...(newTopId ? { [newTopId]: false } : {}),
      }));
      setAnimatingHistoryId(null);
    }, 500);

    setTimeout(() => {
      setFastAddNotice(null);
    }, 1500);
  };

  const handleSelectFoodWithHistory = (food: FoodSearchResult) => {
    let foodToSelect = food;
    if (foodToSelect.lastLoggedAmount === undefined || foodToSelect.lastLoggedAmount === null) {
      const allRecords = StorageService.getAllFoodRecords();
      const cleanTargetId = food.id.replace(/^(custom_|cloud_|preset_|tfda_|ai_photo_|ai_est_|ai_estimation_|record_)/, '');
      const targetName = food.name.trim().toLowerCase();
      const match = allRecords
        .filter((r) => {
          const cleanSourceId = (r.sourceFoodId || r.id).replace(/^(custom_|cloud_|preset_|tfda_|ai_photo_|ai_est_|ai_estimation_|record_)/, '');
          return cleanSourceId === cleanTargetId || r.sourceFoodId === food.id || r.id === food.id || r.name.trim().toLowerCase() === targetName;
        })
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      if (match && match.loggedAmount > 0) {
        foodToSelect = { ...food, lastLoggedAmount: match.loggedAmount };
      }
    }
    onSelectFood(foodToSelect, selectedMealType);
  };

  const filteredHistoryRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return historyRecords;
    return historyRecords.filter((r) => {
      const matchName = r.name.toLowerCase().includes(q);
      const matchBrand = (r.brand || '').toLowerCase().includes(q);
      return matchName || matchBrand;
    });
  }, [historyRecords, searchQuery]);

  const handleFastAdd = (food: FoodSearchResult) => {
    if (onFastAddFood) {
      onFastAddFood(food, selectedMealType);
    } else {
      onSelectFood(food, selectedMealType);
      return;
    }
    const updated = StorageService.getRecentFoodHistory(selectedMealType, 7);
    setHistoryRecords(updated);
    const newTopId = updated[0]?.id;
    setAddedIds((prev) => ({ ...prev, [food.id]: true, ...(newTopId ? { [newTopId]: true } : {}) }));
    setFastAddNotice(`已快速新增「${food.name}」！`);

    setTimeout(() => {
      setAddedIds((prev) => ({
        ...prev,
        [food.id]: false,
        ...(newTopId ? { [newTopId]: false } : {}),
      }));
    }, 500);

    setTimeout(() => {
      setFastAddNotice(null);
    }, 1500);
  };

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
  const [isAiCameraModalOpen, setIsAiCameraModalOpen] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Barcode state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeError, setBarcodeError] = useState('');
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [showBarcodeNotFoundModal, setShowBarcodeNotFoundModal] = useState(false);
  const [notFoundBarcode, setNotFoundBarcode] = useState('');

  // Online Open Food Facts search state
  const [isOnlineSearching, setIsOnlineSearching] = useState(false);
  const [onlineResults, setOnlineResults] = useState<FoodSearchResult[]>([]);

  // FamilyMart Search state (default empty, record history when searched)
  const [familyKeyword, setFamilyKeyword] = useState('');
  const [isFamilySearching, setIsFamilySearching] = useState(false);
  const [familyResults, setFamilyResults] = useState<FoodSearchResult[]>([]);
  const [familyError, setFamilyError] = useState('');
  const [showBatchModal, setShowBatchModal] = useState(false);

  const handleFamilySearch = async (keywordToSearch?: string) => {
    const query = (keywordToSearch !== undefined ? keywordToSearch : familyKeyword).trim();
    if (!query) return;

    setIsFamilySearching(true);
    setFamilyError('');
    setFamilyResults([]);

    try {
      // 方案一 (LocalStorage) & 方案二 (Firestore) Cache check
      const cached = await FamilyCacheService.getCachedFamilySearch(query);
      if (cached && cached.length > 0) {
        setFamilyResults(cached);
        setIsFamilySearching(false);
        return;
      }

      const res = await fetch('/api/family/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: query })
      });

      if (!res.ok) {
        throw new Error('搜尋全家食品失敗，請稍後重試');
      }

      const data = await res.json();
      if (data.products && Array.isArray(data.products)) {
        setFamilyResults(data.products);
        await FamilyCacheService.setCachedFamilySearch(query, data.products);
        if (data.products.length === 0) {
          setFamilyError('找不到符合的全家食品，請嘗試其他關鍵字（例如：飯糰、地瓜、茶、雞胸肉）。');
        }
      }
    } catch (err: any) {
      console.error('Family search error:', err);
      setFamilyError(err.message || '搜尋發生錯誤');
    } finally {
      setIsFamilySearching(false);
    }
  };

  const handleClearFamilyHistory = () => {
    setFamilyKeyword('');
    setFamilyResults([]);
    setFamilyError('');
    localStorage.removeItem('fitpocket_family_keyword');
    localStorage.removeItem('fitpocket_family_results');
  };

  // Cloud foods state
  const [cloudFoods, setCloudFoods] = useState<FoodSearchResult[]>([]);
  const [isCloudLoading, setIsCloudLoading] = useState(false);

  // Saved open foods state
  const [openFoods, setOpenFoods] = useState<FoodSearchResult[]>([]);

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

  // Fetch saved open foods from Firestore
  const loadOpenFoods = async (queryStr: string = '') => {
    try {
      const results = await OpenFoodService.fetchSavedOpenFoods(queryStr);
      setOpenFoods(results);
    } catch (e) {
      console.warn('Error loading open foods:', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'ALL' || activeTab === 'CLOUD') {
      loadCloudFoods(searchQuery);
    }
    if (activeTab === 'OPEN_FOOD') {
      loadOpenFoods(searchQuery);
    }
  }, [activeTab, searchQuery]);

  // FamilyMart eaten history
  const familyHistoryRecords = useMemo(() => {
    const all = StorageService.getAllFoodRecords();
    const familyRecs = all.filter((r) => {
      const isBrandMatch = r.brand && (r.brand.includes('全家') || r.brand.toLowerCase().includes('family'));
      const isSourceMatch = r.sourceFoodId && r.sourceFoodId.startsWith('family_');
      return isBrandMatch || isSourceMatch;
    });

    familyRecs.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const map = new Map<string, FoodRecord>();
    for (const rec of familyRecs) {
      const key = rec.sourceFoodId || rec.name.trim();
      map.set(key, rec);
    }
    return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [historyRecords]);

  // Filter foods by tab and query (merging local + cloud on ALL tab)
  const filteredFoods = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const local = StorageService.searchFoods('');
    let list: FoodSearchResult[] = [];

    if (activeTab === 'ALL') {
      const map = new Map<string, FoodSearchResult>();
      
      // 1. Local foods (presets + custom)
      local.forEach((f) => {
        const key = f.barcode ? `bc_${f.barcode}` : `${f.name.trim().toLowerCase()}_${(f.brand || '').trim().toLowerCase()}`;
        map.set(key, f);
      });

      // 2. Cloud foods (cloud_foods)
      cloudFoods.forEach((cf) => {
        const key = cf.barcode ? `bc_${cf.barcode}` : `${cf.name.trim().toLowerCase()}_${(cf.brand || '').trim().toLowerCase()}`;
        if (!map.has(key)) {
          map.set(key, cf);
        }
      });

      // 3. FamilyMart scraper results if available
      familyResults.forEach((fr) => {
        const key = `${fr.name.trim().toLowerCase()}_${(fr.brand || '').trim().toLowerCase()}`;
        if (!map.has(key)) {
          map.set(key, fr);
        }
      });

      list = Array.from(map.values());
    } else if (activeTab === 'OFFICIAL') {
      list = local.filter(
        (f) =>
          f.brand?.includes('衛福部') ||
          f.brand?.includes('官方') ||
          f.brand?.includes('台灣') ||
          f.id.startsWith('tfda_')
      );
    } else if (activeTab === 'CUSTOM') {
      list = local.filter((f) => f.isUserCustom);
    } else if (activeTab === 'FAMILY') {
      list = familyResults;
    } else if (activeTab === 'OPEN_FOOD') {
      list = openFoods;
    } else {
      list = local;
    }

    if (!q) return list;

    return list.filter((item) => {
      const matchName = item.name.toLowerCase().includes(q);
      const matchBrand = item.brand?.toLowerCase().includes(q);
      const matchBarcode = item.barcode && item.barcode.includes(q);
      return matchName || matchBrand || matchBarcode;
    });
  }, [cloudFoods, familyResults, activeTab, searchQuery]);

  // Handle Online OpenFoodFacts Search
  const handleSearchOnline = async (overrideQuery?: string) => {
    const q = (overrideQuery !== undefined ? overrideQuery : searchQuery).trim();
    if (!q) return;
    setIsOnlineSearching(true);
    try {
      const res = await fetch(
        `/api/openfoodfacts/search?q=${encodeURIComponent(q)}`
      );
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.products || []).map((p: any) => {
          const defaultAmount = p.defaultServingAmount || 100;
          const ratio = defaultAmount / 100;
          const foodId = p.id ? (p.id.startsWith('off_') ? p.id : `off_${p.id}`) : `off_${Date.now()}_${Math.random()}`;
          return {
            id: foodId,
            name: p.name,
            brand: p.brand || 'Open Food Facts',
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
            isOpenFood: true,
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

  useEffect(() => {
    if (activeTab === 'OPEN_FOOD' && searchQuery.trim().length >= 1) {
      const timer = setTimeout(() => {
        handleSearchOnline(searchQuery);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [activeTab, searchQuery]);

  const handleSelectOpenFood = (food: FoodSearchResult) => {
    const item = { ...food, isOpenFood: true };
    OpenFoodService.uploadInBackground(item);
    handleSelectFoodWithHistory(item);
  };

  const handleFastAddOpenFood = (food: FoodSearchResult) => {
    const item = { ...food, isOpenFood: true };
    OpenFoodService.uploadInBackground(item);
    handleFastAdd(item);
  };

  // Handle Barcode lookup
  const handleBarcodeLookup = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBarcodeLoading(true);
    setBarcodeError('');
    try {
      // First check in local database
      const localMatch = StorageService.searchFoods('').find((f: FoodSearchResult) => f.barcode === trimmed);
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
      setNotFoundBarcode(trimmed);
      setShowBarcodeNotFoundModal(true);
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

      // 核心優化：在前端先壓縮圖片，大幅縮減上傳時間 (最佳化為 768x768，Gemini 視覺識別最速甜點尺寸)
      const optimizedBase64 = await optimizeImageForAi(base64, 768, 768, 0.7);

      const userKey = StorageService.getGeminiApiKey();
      const model = StorageService.getSelectedAiModel();
      
      setAiProgress(40);
      setAiStatus(`[${model}] 資料上傳中...`);

      // Smooth progression timer during active network fetch
      let currentProgress = 40;
      const progressInterval = setInterval(() => {
        if (currentProgress < 85) {
          currentProgress += 3; // Slightly faster incremental animation
          const roundedProgress = Math.min(Math.round(currentProgress), 85);
          setAiProgress(roundedProgress);
          
          if (roundedProgress >= 40 && roundedProgress < 58) {
            setAiStatus(`[${model}] 資料上傳中...`);
          } else {
            setAiStatus(`[${model}] AI分析中...`);
          }
        }
      }, 200);

      let res;
      try {
        res = await fetch('/api/ai/estimate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: optimizedBase64, // 使用優化後的 base64
            mimeType: 'image/jpeg', // 壓縮後已統一格式為 jpeg
            customApiKey: userKey,
            model,
          }),
        });
      } finally {
        clearInterval(progressInterval);
      }

      setAiProgress(88);
      setAiStatus('分析完成！');

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const isBusy = res.status === 503 || res.status === 429;
        const msg = isBusy 
          ? 'AI 伺服器目前較為繁忙，請稍候重試或再點擊一次「再試一次」按鈕。' 
          : (errData.error || '照片辨識失敗');
        throw new Error(msg);
      }

      // Download and parse JSON stream first (blisteringly fast now without Google Search Grounding)
      const result = await res.json();

      const usedModel = result._modelUsed || model;
      const isFallback = usedModel !== model;

      setAiProgress(96);
      if (isFallback) {
        setAiStatus(`[${usedModel}] 資料擷取中... (由 ${model} 自動切換後援)`);
      } else {
        setAiStatus(`[${usedModel}] 資料擷取中...`);
      }

      const parseNum = (val: any, fallback: number) => {
        const n = Number(val);
        return isNaN(n) ? fallback : n;
      };
      const defaultAmount = parseNum(result.defaultServingAmount, 200) || 200;
      const ratio = defaultAmount / 100;
      const calories = Math.round(parseNum(result.caloriesPer100g, 150) * ratio * 10) / 10;
      const carbs = Math.round(parseNum(result.carbsPer100g, 0) * ratio * 10) / 10;
      const protein = Math.round(parseNum(result.proteinPer100g, 10) * ratio * 10) / 10;
      const fat = Math.round(parseNum(result.fatPer100g, 5) * ratio * 10) / 10;
      const sugars = Math.round(parseNum(result.sugarsPer100g, 0) * ratio * 10) / 10;
      const fiber = Math.round(parseNum(result.fiberPer100g, 0) * ratio * 10) / 10;
      const sodium = Math.round(parseNum(result.sodiumPer100g, 0) * ratio * 10) / 10;
      const potassium = Math.round(parseNum(result.potassiumPer100g, 0) * ratio * 10) / 10;

      // Extract and normalize brand (e.g. 7-11, 全家, 萊爾富, OK) and barcode
      const rawBrand = result.brand ? String(result.brand).trim() : '';
      const normalizedBrand = (rawBrand && rawBrand !== 'AI辨識' && rawBrand !== 'AI 視覺辨識')
        ? CloudFoodService.normalizeBrand(rawBrand)
        : 'AI辨識';
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

      // Automatically save to Custom Foods store & Cloud
      const customToSave: CustomFood = {
        id: `custom_${foodItem.id}`,
        name: foodItem.name,
        brand: foodItem.brand || 'AI辨識',
        servingAmount: foodItem.servingAmount || 100,
        servingUnit: foodItem.servingUnit || 'g',
        calories: foodItem.calories,
        carbs: foodItem.carbs,
        protein: foodItem.protein,
        fat: foodItem.fat,
        sugars: foodItem.sugars,
        fiber: foodItem.fiber,
        sodium: foodItem.sodium,
        potassium: foodItem.potassium,
        barcode: foodItem.barcode,
        updatedAt: Date.now(),
        isSharedToCloud: true,
      };
      StorageService.saveCustomFood(customToSave);
      CloudFoodService.uploadInBackground(customToSave);

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
      setAiStatus(`[${model}] 正在由 AI 營養師估算熱量與三大營養素...`);
      
      const res = await fetch('/api/ai/estimate-nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: aiPrompt.trim(), 
          customApiKey: userKey,
          model 
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const isBusy = res.status === 503 || res.status === 429;
        const msg = isBusy 
          ? 'AI 伺服器目前較為繁忙，請稍候重試或點擊「再試一次」。' 
          : (errData.error || '估算失敗');
        throw new Error(msg);
      }

      const result = await res.json();
      const usedModel = result._modelUsed || model;
      const isFallback = usedModel !== model;

      setAiProgress(85);
      if (isFallback) {
        setAiStatus(`[${usedModel}] 正在生成營養成分清單... (由 ${model} 自動切換後援)`);
      } else {
        setAiStatus(`[${usedModel}] 正在生成營養成分清單...`);
      }

      const parseNum = (val: any, fallback: number) => {
        const n = Number(val);
        return isNaN(n) ? fallback : n;
      };
      const defaultAmount = parseNum(result.defaultServingAmount, 100) || 100;
      const ratio = defaultAmount / 100;
      const calories = Math.round(parseNum(result.caloriesPer100g, 150) * ratio * 10) / 10;
      const carbs = Math.round(parseNum(result.carbsPer100g, 0) * ratio * 10) / 10;
      const protein = Math.round(parseNum(result.proteinPer100g, 10) * ratio * 10) / 10;
      const fat = Math.round(parseNum(result.fatPer100g, 5) * ratio * 10) / 10;
      const sugars = Math.round(parseNum(result.sugarsPer100g, 0) * ratio * 10) / 10;
      const fiber = Math.round(parseNum(result.fiberPer100g, 0) * ratio * 10) / 10;
      const sodium = Math.round(parseNum(result.sodiumPer100g, 0) * ratio * 10) / 10;
      const potassium = Math.round(parseNum(result.potassiumPer100g, 0) * ratio * 10) / 10;

      const rawBrand = result.brand ? String(result.brand).trim() : '';
      const normalizedBrand = (rawBrand && rawBrand !== 'AI辨識' && rawBrand !== 'AI 智慧估算')
        ? CloudFoodService.normalizeBrand(rawBrand)
        : 'AI辨識';

      const foodItem: FoodSearchResult = {
        id: 'ai_' + Date.now(),
        name: result.name || aiPrompt.trim(),
        brand: normalizedBrand,
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

      // Automatically save to Custom Foods store & Cloud
      const customToSave: CustomFood = {
        id: `custom_${foodItem.id}`,
        name: foodItem.name,
        brand: foodItem.brand || 'AI辨識',
        servingAmount: foodItem.servingAmount || 100,
        servingUnit: foodItem.servingUnit || 'g',
        calories: foodItem.calories,
        carbs: foodItem.carbs,
        protein: foodItem.protein,
        fat: foodItem.fat,
        sugars: foodItem.sugars,
        fiber: foodItem.fiber,
        sodium: foodItem.sodium,
        potassium: foodItem.potassium,
        updatedAt: Date.now(),
        isSharedToCloud: true,
      };
      StorageService.saveCustomFood(customToSave);
      CloudFoodService.uploadInBackground(customToSave);

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
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'ALL' || activeTab === 'OPEN_FOOD' || activeTab === 'OFFICIAL' || activeTab === 'CUSTOM' || activeTab === 'CLOUD'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Search className="w-4 h-4" />
            一般搜尋
          </button>
          <button
            onClick={() => {
              if (!checkAiKeyOrWarn()) return;
              setActiveTab('AI_SCAN');
            }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'AI_SCAN' || activeTab === 'BARCODE'
                ? 'bg-purple-700 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI搜尋
          </button>
          <button
            onClick={() => setActiveTab('FAMILY')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'FAMILY'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Store className="w-4 h-4" />
            全家搜尋
          </button>
        </div>

        {/* Conditional Search/Tool Bar */}
        {(activeTab === 'ALL' || activeTab === 'OPEN_FOOD' || activeTab === 'OFFICIAL' || activeTab === 'CUSTOM' || activeTab === 'CLOUD') && (
          <div className="px-4 pt-3 pb-2">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder={
                  activeTab === 'OPEN_FOOD'
                    ? '搜尋 Open Food Facts 全球食品資料庫...'
                    : activeTab === 'CLOUD'
                    ? '搜尋公共網路食品資料庫...'
                    : '搜尋衛福部官方資料庫或自訂飲食...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && activeTab === 'OPEN_FOOD' && handleSearchOnline()}
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
              <button onClick={() => setActiveTab('OPEN_FOOD')} className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer flex items-center gap-1 ${activeTab === 'OPEN_FOOD' ? 'bg-amber-600 text-white shadow-xs' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'}`}>
                <Globe className="w-3.5 h-3.5" />
                Open Food
              </button>
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
        <div ref={contentBodyRef} className="flex-1 overflow-y-auto p-4">
          {/* TAB: FAMILY SEARCH */}
          {activeTab === 'FAMILY' && (
            <div className="space-y-4 max-w-md mx-auto py-2">
              <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-4 text-emerald-900">
                <div className="flex items-center gap-2 font-bold text-sm mb-1">
                  <Store className="w-4 h-4 text-emerald-600" />
                  全家食在購安心 官方資料庫查詢
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  直接串接全家便利商店官方食安與營養標示資料庫（foodsafety.family.com.tw），輸入關鍵字（例如：飯糰、地瓜、雞胸肉、茶）即可查詢真實營養成分！
                </p>
              </div>

              {/* 智慧批次爬蟲按鈕 (移至關鍵字搜尋上方) */}
              <button
                type="button"
                onClick={() => setShowBatchModal(true)}
                className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-black rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>🎯 開啟全家智慧批次爬蟲 (20+ 預設與自訂選擇)</span>
              </button>

              {showBatchModal && (
                <BatchCrawlModal
                  onClose={() => setShowBatchModal(false)}
                  onFinished={() => setShowBatchModal(false)}
                />
              )}

              {/* 關鍵字搜尋框 */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <label className="block text-xs font-bold text-slate-700">搜尋全家食品關鍵字</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="例如: 飯糰、地瓜、茶、雞胸肉"
                    value={familyKeyword}
                    onChange={(e) => setFamilyKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFamilySearch()}
                    className="flex-1 px-3 py-2.5 bg-white rounded-xl border border-slate-200 text-sm focus:outline-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleFamilySearch()}
                    disabled={isFamilySearching || !familyKeyword.trim()}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {isFamilySearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    搜尋全家
                  </button>
                </div>
              </div>

              {familyError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{familyError}</span>
                </div>
              )}

              {/* 過往食用過的全家食品區塊 */}
              {familyHistoryRecords.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200/60">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-emerald-600" />
                      <h5 className="text-[11px] font-black text-slate-700 tracking-wider">過往食用過的全家食品</h5>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">共 {familyHistoryRecords.length} 項</span>
                  </div>
                  {familyHistoryRecords.map((record) => {
                    const searchItem = mapRecordToSearchResult(record);
                    const isAnimating = animatingHistoryId === record.id;
                    const isAdded = addedIds[record.id] || addedIds[searchItem.id];
                    return (
                      <div
                        key={`fam_hist_${record.id}`}
                        onClick={() => handleSelectFoodWithHistory(searchItem)}
                        className="p-3 bg-white border border-emerald-100 hover:border-emerald-400 rounded-2xl hover:shadow-xs transition cursor-pointer flex items-start justify-between gap-3 group"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0 h-8">
                            <h4 className="font-bold text-sm text-slate-900 group-hover:text-emerald-800 truncate min-w-0 shrink">
                              {record.name}
                            </h4>
                            <span className="text-[10px] font-bold px-1.5 py-0.25 bg-emerald-100 text-emerald-800 rounded-md whitespace-nowrap shrink-0">
                              全家
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectFoodWithHistory(searchItem);
                              }}
                              className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                              title="設定份量並新增"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="text-[11px] font-semibold text-slate-400 -mt-0.5 mb-1">
                            {record.brand || '全家'}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pb-0.5">
                            <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              {record.loggedAmount}{record.loggedUnit}
                            </span>
                            <span className="text-[11px] font-bold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              {record.calories} kcal
                            </span>
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">C:{record.carbs}</span>
                            <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">P:{record.protein}</span>
                            <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">F:{record.fat}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickAddHistory(record);
                          }}
                          disabled={isAnimating}
                          className={`p-2.5 rounded-xl transition-all duration-300 shrink-0 cursor-pointer flex items-center justify-center ${
                            isAnimating || isAdded
                              ? 'bg-emerald-500 text-white scale-110 shadow-md ring-2 ring-emerald-300'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white'
                          }`}
                          title="快速新增至當前餐點"
                        >
                          {isAnimating || isAdded ? (
                            <Check className="w-5 h-5 animate-in zoom-in-75 duration-200" />
                          ) : (
                            <Plus className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {familyResults.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-200/60">
                  <div className="flex items-center justify-between px-1">
                    <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">全家查詢結果 ({familyResults.length})</h5>
                    <button 
                      onClick={handleClearFamilyHistory}
                      className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                    >
                      清除歷程
                    </button>
                  </div>
                  {familyResults.map((food) => (
                    <div
                      key={food.id}
                      onClick={() => onSelectFood(food)}
                      className="p-3 bg-white border border-slate-100 hover:border-emerald-300 rounded-2xl hover:shadow-sm transition cursor-pointer flex items-start justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0 h-8">
                          <h4 className="font-bold text-sm text-slate-900 group-hover:text-emerald-800 truncate min-w-0 shrink">
                            {food.name}
                          </h4>
                          <div className="inline-flex items-center gap-1 shrink-0">
                            <span className="text-[10px] font-bold px-1.5 py-0.25 bg-emerald-100 text-emerald-800 rounded-md whitespace-nowrap">
                              全家官網
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectFood(food);
                              }}
                              className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                              title="點擊修改/設定份量"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="text-[11px] font-semibold text-slate-400 -mt-0.5 mb-1">
                          全家
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pb-0.5">
                          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            {food.servingAmount}{food.servingUnit}
                          </span>
                          <span className="text-[11px] font-bold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            {food.calories} kcal
                          </span>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">C:{food.carbs}</span>
                          <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">P:{food.protein}</span>
                          <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">F:{food.fat}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFastAdd(food);
                        }}
                        className={`p-2 rounded-xl transition-all duration-200 shrink-0 cursor-pointer flex items-center justify-center ${
                          addedIds[food.id]
                            ? 'bg-emerald-500 text-white scale-105 shadow-xs'
                            : 'text-slate-400 group-hover:text-emerald-700 group-hover:bg-emerald-50'
                        }`}
                        title="快速新增至餐點"
                      >
                        {addedIds[food.id] ? (
                          <Check className="w-5 h-5 animate-in zoom-in-50 duration-200" />
                        ) : (
                          <Plus className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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

              {/* Photo upload section & Camera trigger */}
              <div className="bg-white border-2 border-dashed border-purple-200 rounded-3xl p-5 text-center hover:border-purple-400 transition shadow-xs space-y-3">
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
                  <div className="relative inline-block group">
                    <img
                      src={selectedImageBase64}
                      alt="辨識照片預覽"
                      className="w-36 h-36 object-cover rounded-2xl border-2 border-purple-300 shadow-sm mx-auto"
                    />
                    <button
                      type="button"
                      onClick={() => setIsAiCameraModalOpen(true)}
                      className="absolute bottom-2 right-2 p-1.5 bg-purple-700 text-white rounded-xl shadow-md text-xs font-bold hover:bg-purple-800 transition cursor-pointer flex items-center gap-1"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      重拍
                    </button>
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center mx-auto shadow-xs">
                    <Camera className="w-7 h-7" />
                  </div>
                )}

                <div>
                  <h4 className="font-bold text-sm text-slate-800">
                    {selectedImageBase64 ? '已備妥餐點照片，準備辨識' : '開啟 AI 相機拍照或選取照片'}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">支援相機即時取景拍照、實體菜單與相簿照片</p>
                </div>
                
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (!checkAiKeyOrWarn()) return;
                      setIsAiCameraModalOpen(true);
                    }}
                    disabled={aiLoading}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-2xl shadow-sm transition inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
                  >
                    <Camera className="w-4 h-4" />
                    開啟 AI 拍照對話框 (相機鏡頭 / 相簿)
                  </button>
                </div>
              </div>

              {/* Or text describe */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  或輸入食物名稱 / 外食描述
                </label>
                <div className="space-y-2.5">
                  <input
                    type="text"
                    placeholder="例如: 摩斯藜麥燒肉珍珠堡、超商烤雞便當"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAiTextAnalyze()}
                    className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-sm focus:outline-purple-600"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAiTextAnalyze}
                      disabled={aiLoading || !aiPrompt.trim()}
                      className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      AI 估算
                    </button>
                  </div>
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
              {/* Camera scanner callout card */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl p-5 text-white shadow-md relative overflow-hidden">
                <div className="relative z-10 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-base">
                    <Camera className="w-5 h-5 text-blue-200 animate-pulse" />
                    相機即時條碼掃描
                  </div>
                  <p className="text-xs text-blue-100 leading-relaxed">
                    對準包裝上的商品條碼 (EAN-13 / UPC)，或上傳條碼照片，將自動解碼並查詢食品庫！
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsScannerModalOpen(true)}
                    className="w-full py-3 bg-white hover:bg-blue-50 text-blue-900 font-extrabold text-xs rounded-2xl shadow-sm transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <Camera className="w-4 h-4 text-blue-600" />
                    開啟相機 / 相片掃描條碼
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">或手動輸入商品條碼號碼</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="例如: 4710088195001"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleBarcodeLookup(barcodeInput)}
                      className="w-full pl-3 pr-9 py-2 bg-white rounded-xl border border-slate-200 text-sm font-mono focus:outline-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setIsScannerModalOpen(true)}
                      title="開啟相機鏡頭掃描"
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
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
                  onClick={() => onOpenCustomFoodModal()}
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
                    onClick={() => handleSelectFoodWithHistory(food)}
                    className="p-3 bg-white border border-slate-200 hover:border-sky-400 rounded-2xl hover:shadow-sm transition cursor-pointer flex items-start justify-between gap-3 group"
                  >
                    <div className="min-w-0 flex-1">
                      {/* 1. 名稱 & 膠囊 & 編輯 */}
                      <div className="flex items-center gap-1.5 min-w-0 h-8">
                        <h4 className="font-bold text-sm text-slate-900 group-hover:text-sky-800 truncate min-w-0 shrink">
                          {food.name}
                        </h4>
                        <div className="inline-flex items-center gap-1 shrink-0">
                          <span className="text-[10px] font-bold px-1.5 py-0.25 bg-sky-100 text-sky-800 rounded-md flex items-center gap-0.5 whitespace-nowrap">
                            <Cloud className="w-2.5 h-2.5 text-sky-600" />
                            網路資料庫
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectFoodWithHistory(food);
                            }}
                            className="p-1 text-slate-400 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                            title="點擊修改/設定份量"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 2. 品牌 */}
                      <div className="text-[11px] font-semibold text-slate-400 -mt-0.5 mb-1">
                        {food.brand || (food.isUserCustom ? '自訂' : '一般食材')}
                      </div>

                      {/* 3. 重量 · 熱量 · CPF 一排 */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pb-0.5">
                        <span className="text-[11px] font-bold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          {food.servingAmount}{food.servingUnit} · {food.calories} kcal
                        </span>
                        <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">C:{food.carbs}</span>
                        <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">P:{food.protein}</span>
                        <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">F:{food.fat}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFastAdd(food);
                      }}
                      className={`p-2 rounded-xl transition-all duration-200 shrink-0 cursor-pointer flex items-center justify-center ${
                        addedIds[food.id]
                          ? 'bg-emerald-500 text-white scale-105 shadow-xs'
                          : 'text-slate-400 group-hover:text-sky-600 group-hover:bg-sky-50'
                      }`}
                      title="快速新增至餐點（不關閉搜尋）"
                    >
                      {addedIds[food.id] ? (
                        <Check className="w-5 h-5 animate-in zoom-in-50 duration-200" />
                      ) : (
                        <Plus className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-10 text-center space-y-3 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-sm font-medium text-slate-600">目前網路資料庫尚無符合的食品</p>
                  <p className="text-xs text-slate-400">您可以手動新增並同步上傳擴充資料庫！</p>
                  <button
                    type="button"
                    onClick={() => onOpenCustomFoodModal()}
                    className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 transition inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    新增自訂食品
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB: OPEN_FOOD */}
          {activeTab === 'OPEN_FOOD' && (
            <div className="space-y-3">
              <div className="p-3.5 bg-gradient-to-r from-amber-600 to-orange-600 rounded-2xl text-white shadow-sm flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <Globe className="w-4 h-4 text-amber-200" />
                    Open Food Facts 全球食品資料庫
                  </div>
                  <p className="text-xs text-amber-100 mt-0.5">
                    線上即時檢索全球 Open Food API，新增時將自動同步存入 open_foods 集合
                  </p>
                </div>
              </div>

              {isOnlineSearching ? (
                <div className="py-12 text-center space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto" />
                  <p className="text-xs font-medium text-slate-500">正在搜尋 Open Food Facts 全球資料庫...</p>
                </div>
              ) : onlineResults.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-[11px] font-bold text-slate-400 px-1">
                    Open Food 搜尋結果 ({onlineResults.length})
                  </div>
                  {onlineResults.map((food) => (
                    <div
                      key={food.id}
                      onClick={() => handleSelectOpenFood(food)}
                      className="p-3 bg-white border border-amber-100 hover:border-amber-400 rounded-2xl hover:shadow-xs transition cursor-pointer flex items-start justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        {/* 1. 名稱 & 膠囊 & 編輯 */}
                        <div className="flex items-center gap-1.5 min-w-0 h-8">
                          <h4 className="font-bold text-sm text-slate-900 group-hover:text-amber-800 truncate min-w-0 shrink">
                            {food.name}
                          </h4>
                          <div className="inline-flex items-center gap-1 shrink-0">
                            <span className="text-[10px] font-bold px-1.5 py-0.25 bg-amber-100 text-amber-800 rounded-md whitespace-nowrap">
                              Open Food
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectOpenFood(food);
                              }}
                              className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                              title="點擊修改/設定份量"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* 2. 品牌 */}
                        <div className="text-[11px] font-semibold text-slate-400 -mt-0.5 mb-1">
                          {food.brand || 'Open Food Facts'}
                        </div>

                        {/* 3. 重量 · 熱量 · CPF 一排 */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pb-0.5">
                          <span className="text-[11px] font-bold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            {food.servingAmount}{food.servingUnit} · {food.calories} kcal
                          </span>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">C:{food.carbs}</span>
                          <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">P:{food.protein}</span>
                          <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">F:{food.fat}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFastAddOpenFood(food);
                        }}
                        className={`p-2 rounded-xl transition-all duration-200 shrink-0 cursor-pointer flex items-center justify-center ${
                          addedIds[food.id]
                            ? 'bg-emerald-500 text-white scale-105 shadow-xs'
                            : 'text-slate-400 group-hover:text-amber-700 group-hover:bg-amber-50'
                        }`}
                        title="快速新增至餐點並同步至 open_foods 集合"
                      >
                        {addedIds[food.id] ? (
                          <Check className="w-5 h-5 animate-in zoom-in-50 duration-200" />
                        ) : (
                          <Plus className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center space-y-3 bg-amber-50/50 rounded-2xl border border-dashed border-amber-200">
                  <Globe className="w-10 h-10 text-amber-500/70 mx-auto" />
                  <p className="text-sm font-bold text-amber-900">搜尋 Open Food Facts 全球資料庫</p>
                  <p className="text-xs text-amber-700 max-w-sm mx-auto">
                    請在上方的搜尋框輸入食物名稱或品牌，按下 Enter 或點擊搜尋以連線 Open Food API 檢索全球食品資料
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB: ALL, OFFICIAL, CUSTOM */}
          {activeTab !== 'AI_SCAN' && activeTab !== 'BARCODE' && activeTab !== 'CLOUD' && activeTab !== 'FAMILY' && activeTab !== 'OPEN_FOOD' && (
            <div className="space-y-2">
              {/* 歷史紀錄區塊 (僅在「全部」ALL 頁籤，且有歷史紀錄時呈現) */}
              {activeTab === 'ALL' && filteredHistoryRecords.length > 0 && (
                <div className="mb-6 space-y-2.5">
                  {/* Section Header */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-sky-100 flex items-center justify-center text-sky-700">
                        <History className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="font-extrabold text-sm text-slate-800 tracking-tight">歷史紀錄</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-sky-50 text-sky-800 border border-sky-100 rounded-full">
                        近 7 天 · {selectedMealName}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">
                      共 {filteredHistoryRecords.length} 項
                    </span>
                  </div>

                  {/* 已有紀錄 */}
                  <div className="space-y-2">
                    {filteredHistoryRecords.map((record) => {
                      const isAnimating = animatingHistoryId === record.id;
                      const isAdded = addedIds[record.id];
                      return (
                        <div
                          key={`hist_${record.id}`}
                          onClick={() => handleSelectFoodWithHistory(mapRecordToSearchResult(record))}
                          className="p-3 bg-white border border-slate-100 hover:border-sky-300 rounded-2xl hover:shadow-xs transition cursor-pointer flex items-start justify-between gap-3 group"
                        >
                          <div className="min-w-0 flex-1">
                            {/* 1. 名稱 & 膠囊 & 編輯 */}
                            <div className="flex items-center gap-1.5 min-w-0 h-8">
                              <h4 className="font-bold text-sm text-slate-900 group-hover:text-sky-800 truncate min-w-0 shrink">
                                {record.name}
                              </h4>
                              <div className="inline-flex items-center gap-1 shrink-0">
                                {record.sourceFoodId?.startsWith('custom_') && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.25 bg-amber-100 text-amber-800 rounded-md whitespace-nowrap">
                                    我的自訂
                                  </span>
                                )}
                                {(record.sourceFoodId?.startsWith('cloud_') || record.barcode) && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.25 bg-sky-100 text-sky-800 rounded-md whitespace-nowrap">
                                    網路資料庫
                                  </span>
                                )}
                                {record.aiSource === 'vision' && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.25 bg-purple-50 text-purple-700 border border-purple-100 rounded-md whitespace-nowrap">
                                    AI 視覺辨識
                                  </span>
                                )}
                                {record.aiSource === 'estimation' && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.25 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md whitespace-nowrap">
                                    AI 智慧估算
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectFoodWithHistory(mapRecordToSearchResult(record));
                                  }}
                                  className="p-1 text-slate-400 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                                  title="設定份量並新增"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* 2. 品牌 */}
                            <div className="text-[11px] font-semibold text-slate-400 -mt-0.5 mb-1">
                              {record.brand || '自訂'}
                            </div>

                            {/* 3. 重量(上次份量) · 熱量 · CPF 一排 */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pb-0.5">
                              <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                {record.loggedAmount}{record.loggedUnit}
                              </span>
                              <span className="text-[11px] font-bold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                {record.calories} kcal
                              </span>
                              <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">C:{record.carbs}</span>
                              <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">P:{record.protein}</span>
                              <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">F:{record.fat}</span>
                            </div>
                          </div>

                          {/* 4. Quick Add Button with Animation */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleQuickAddHistory(record);
                            }}
                            disabled={isAnimating}
                            className={`p-2.5 rounded-xl transition-all duration-300 shrink-0 cursor-pointer flex items-center justify-center ${
                              isAnimating || isAdded
                                ? 'bg-emerald-500 text-white scale-110 shadow-md ring-2 ring-emerald-300'
                                : 'bg-sky-50 text-sky-700 hover:bg-sky-600 hover:text-white'
                            }`}
                            title="快速新增至當前餐點"
                          >
                            {isAnimating || isAdded ? (
                              <Check className="w-5 h-5 animate-in zoom-in-75 duration-200" />
                            ) : (
                              <Plus className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Section Divider */}
                  <div className="pt-2 pb-1 flex items-center gap-2">
                    <div className="h-px bg-slate-200 flex-1" />
                    <span className="text-[11px] font-bold text-slate-400">全庫食品與自訂項目</span>
                    <div className="h-px bg-slate-200 flex-1" />
                  </div>
                </div>
              )}

              {filteredFoods.length > 0 ? (
                filteredFoods.map((food) => (
                    <div key={food.id} onClick={() => handleSelectFoodWithHistory(food)} className="p-3 bg-white border border-slate-100 hover:border-sky-300 rounded-2xl hover:shadow-sm transition cursor-pointer flex items-start justify-between gap-3 group">
                      <div className="min-w-0 flex-1">
                        {/* 1. 名稱 & 膠囊 & 編輯 */}
                        <div className="flex items-center gap-1.5 min-w-0 h-8">
                          <h4 className="font-bold text-sm text-slate-900 group-hover:text-sky-800 truncate min-w-0 shrink">
                            {food.name}
                          </h4>
                          <div className="inline-flex items-center gap-1 shrink-0">
                            {food.isUserCustom && (
                              <span className="text-[10px] font-bold px-1.5 py-0.25 bg-amber-100 text-amber-800 rounded-md whitespace-nowrap">
                                我的自訂
                              </span>
                            )}
                            {food.id.startsWith('cloud_') && (
                              <span className="text-[10px] font-bold px-1.5 py-0.25 bg-sky-100 text-sky-800 rounded-md whitespace-nowrap">
                                網路資料庫
                              </span>
                            )}
                            {(food.isOpenFood || food.id.startsWith('off_') || food.id.startsWith('open_')) && (
                              <span className="text-[10px] font-bold px-1.5 py-0.25 bg-amber-100 text-amber-800 rounded-md whitespace-nowrap">
                                Open Food
                              </span>
                            )}
                            {(food.aiSource === 'vision' || food.brand === 'AI 視覺辨識') && (
                              <span className="text-[10px] font-bold px-1.5 py-0.25 bg-purple-50 text-purple-700 border border-purple-100 rounded-md whitespace-nowrap">
                                AI 視覺辨識
                              </span>
                            )}
                            {(food.aiSource === 'estimation' || food.brand === 'AI 智慧估算') && (
                              <span className="text-[10px] font-bold px-1.5 py-0.25 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-md whitespace-nowrap">
                                AI 智慧估算
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectFoodWithHistory(food);
                              }}
                              className="p-1 text-slate-400 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition cursor-pointer"
                              title="點擊修改/設定份量"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* 2. 品牌 */}
                        <div className="text-[11px] font-semibold text-slate-400 -mt-0.5 mb-1">
                          {(() => {
                            const isVision = food.aiSource === 'vision' || food.brand === 'AI 視覺辨識';
                            const isEstimation = food.aiSource === 'estimation' || food.brand === 'AI 智慧估算';
                            if (isVision || isEstimation) {
                              return food.brand && food.brand !== 'AI 視覺辨識' && food.brand !== 'AI 智慧估算'
                                ? food.brand
                                : 'AI辨識';
                            }
                            return food.brand || '自訂';
                          })()}
                        </div>

                        {/* 3. 重量 · 熱量 · CPF 一排 (與主頁格式完全相同) */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pb-0.5">
                          <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            {food.servingAmount}{food.servingUnit}
                          </span>
                          <span className="text-[11px] font-bold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            {food.calories} kcal
                          </span>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">C:{food.carbs}</span>
                          <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">P:{food.protein}</span>
                          <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">F:{food.fat}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFastAdd(food);
                        }}
                        className={`p-2 rounded-xl transition-all duration-200 shrink-0 cursor-pointer flex items-center justify-center ${
                          addedIds[food.id]
                            ? 'bg-emerald-500 text-white scale-105 shadow-xs'
                            : 'text-slate-400 group-hover:text-sky-700 group-hover:bg-sky-50'
                        }`}
                        title="快速新增至餐點（不關閉搜尋）"
                      >
                        {addedIds[food.id] ? (
                          <Check className="w-5 h-5 animate-in zoom-in-50 duration-200" />
                        ) : (
                          <Plus className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                ))
              ) : (
                <div className="py-8 text-center space-y-3">
                  <p className="text-sm text-slate-500">找不到相符的本地食物項目</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('OPEN_FOOD');
                        handleSearchOnline();
                      }}
                      disabled={isOnlineSearching}
                      className="px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-semibold hover:bg-amber-700 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {isOnlineSearching ? '正在雲端搜尋...' : '開啟 Open Food 專區搜尋'}
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
                      className="p-3 bg-blue-50/50 border border-blue-100 rounded-2xl hover:border-blue-300 transition cursor-pointer flex items-start justify-between gap-3 group"
                    >
                      <div className="min-w-0 flex-1">
                        {/* 1. 名稱 & 膠囊 & 編輯 */}
                        <div className="flex items-center gap-1.5 min-w-0 h-8">
                          <h4 className="font-bold text-sm text-slate-800 group-hover:text-blue-900 truncate min-w-0 shrink">
                            {food.name}
                          </h4>
                          <div className="inline-flex items-center gap-1 shrink-0">
                            <span className="text-[10px] font-bold px-1.5 py-0.25 bg-blue-100 text-blue-800 rounded-md whitespace-nowrap">
                              全球資料庫
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectFood(food, selectedMealType);
                              }}
                              className="p-1 text-slate-400 hover:text-blue-700 hover:bg-blue-100 rounded-lg transition cursor-pointer"
                              title="點擊修改/設定份量"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                      {/* 2. 品牌 */}
                      <div className="text-[11px] font-semibold text-slate-400 -mt-0.5 mb-1">
                        {food.brand || (food.isUserCustom ? '自訂' : '一般食材')}
                      </div>

                      {/* 3. 重量 · 熱量 · CPF 一排 */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pb-0.5">
                          <span className="text-[11px] font-bold text-blue-900 bg-blue-100/50 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            每份 ({food.servingAmount}{food.servingUnit}) · {food.calories} kcal
                          </span>
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">C:{food.carbs}</span>
                          <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">P:{food.protein}</span>
                          <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-1.5 py-0.5 rounded-full whitespace-nowrap">F:{food.fat}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFastAdd(food);
                        }}
                        className={`p-2 rounded-xl transition-all duration-200 shrink-0 cursor-pointer flex items-center justify-center ${
                          addedIds[food.id]
                            ? 'bg-emerald-500 text-white scale-105 shadow-xs'
                            : 'text-blue-600 group-hover:bg-blue-100 rounded-xl'
                        }`}
                        title="快速新增至餐點（不關閉搜尋）"
                      >
                        {addedIds[food.id] ? (
                          <Check className="w-5 h-5 animate-in zoom-in-50 duration-200" />
                        ) : (
                          <Plus className="w-5 h-5" />
                        )}
                      </button>
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
            onClick={() => onOpenCustomFoodModal()}
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

        {/* Barcode Camera & Photo Scanner Modal */}
        <BarcodeScannerModal
          isOpen={isScannerModalOpen}
          onClose={() => setIsScannerModalOpen(false)}
          onDetected={(code) => {
            setBarcodeInput(code);
            handleBarcodeLookup(code);
          }}
        />

        {/* AI Photo & Live Stream Camera Modal */}
        <AiCameraModal
          isOpen={isAiCameraModalOpen}
          onClose={() => setIsAiCameraModalOpen(false)}
          onCaptured={(base64, mime) => {
            setSelectedImageBase64(base64);
            setLastImageMimeType(mime);
            performImageAnalysis(base64, mime);
          }}
        />

        {/* Floating Fast Add Notification Toast */}
        {fastAddNotice && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 text-white px-4 py-2.5 rounded-2xl shadow-xl font-bold text-xs flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{fastAddNotice}</span>
          </div>
        )}

        {/* Barcode Not Found Customized Alert Dialog */}
        {showBarcodeNotFoundModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 border border-slate-100 flex flex-col space-y-4 text-center animate-in zoom-in-95 duration-200">
              <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-500 mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-800 text-base">查無此商品</h4>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  資料庫與雲端查無條碼為 <code className="bg-slate-100 px-1.5 py-0.5 rounded text-amber-600 font-bold font-mono">{notFoundBarcode}</code> 的食品。
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  是否要以此條碼直接建立自訂飲食？
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBarcodeNotFoundModal(false);
                    onOpenCustomFoodModal(notFoundBarcode);
                    onClose();
                  }}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  建立自訂飲食
                </button>
                <button
                  type="button"
                  onClick={() => setShowBarcodeNotFoundModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
