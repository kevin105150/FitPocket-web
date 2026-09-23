import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Search, 
  Database, 
  Plus, 
  Check, 
  Loader2, 
  Sparkles, 
  Camera, 
  Image, 
  Globe, 
  Cloud, 
  Store, 
  Info, 
  AlertCircle, 
  Barcode, 
  RefreshCw, 
  History, 
  Clock, 
  ChevronDown,
  Pencil,
  Flame,
  Send
} from 'lucide-react';
import { StorageService } from '../services/storage';
import { FoodSearchResult, FoodRecord, MealType } from '../types';
import { getTodayString } from '../utils/dateUtils';
import { useModalBackHandler } from '../hooks/useModalBackHandler';
import { OpenFoodService } from '../services/openFoodService';
import { CloudFoodService } from '../services/cloudFoodService';
import { FamilyCacheService } from '../services/familyCacheService';
import { McdonaldCacheService } from '../services/mcdonaldCacheService';
import { SubwayCacheService } from '../services/subwayCacheService';
import { auth } from '../lib/firebase';
import { getAiRequestParams } from '../utils/aiHelper';
import { optimizeImageForAi } from '../utils/imageOptimizer';

// Sub-components
import { FoodResultItem } from './food-modal/FoodResultItem';
import { StoreSearchSection } from './food-modal/StoreSearchSection';
import { AiAnalysisSection } from './food-modal/AiAnalysisSection';
import { BarcodeSection } from './food-modal/BarcodeSection';
import { RecentHistorySection } from './food-modal/RecentHistorySection';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { AiCameraModal } from './AiCameraModal';
import { BatchCrawlModal } from './BatchCrawlModal';

export type FoodTab = 'ALL' | 'OFFICIAL' | 'CUSTOM' | 'OPEN_FOOD' | 'CLOUD' | 'AI_SCAN' | 'BARCODE' | 'FAMILY';

interface AddFoodModalProps {
  initialMealType: MealType;
  availableMeals: { type: MealType; name: string }[];
  currentDate?: string;
  initialTab?: FoodTab;
  onClose: () => void;
  onSelectFood: (food: FoodSearchResult, mealType?: MealType) => void;
  onFastAddFood?: (food: FoodSearchResult, mealType: MealType) => void;
  onOpenCustomFoodModal: (initialBarcode?: string) => void;
}

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
  useModalBackHandler(true, onClose);

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

  // Check Admin role
  const isAdmin = (auth.currentUser?.email || '').toLowerCase() === 'kevin10611@gmail.com';

  const checkAiKeyOrWarn = () => {
    const params = getAiRequestParams();
    if (params.apiKeySource === 'custom' && !params.customApiKey) {
      setAiError('請先在設定中輸入 Gemini API Key');
      return false;
    }
    return true;
  };

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
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // Barcode state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeError, setBarcodeError] = useState('');
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [showBarcodeNotFoundModal, setShowBarcodeNotFoundModal] = useState(false);
  const [notFoundBarcode, setNotFoundBarcode] = useState('');

  // Online Open Food Facts search state
  const [onlineResults, setOnlineResults] = useState<FoodSearchResult[]>([]);

  // FamilyMart Search state (default empty, record history when searched)
  const [subStore, setSubStore] = useState<'family' | 'mcd' | 'subway'>('family');
  const [familyKeyword, setFamilyKeyword] = useState('');
  const [isFamilySearching, setIsFamilySearching] = useState(false);
  const [familyResults, setFamilyResults] = useState<FoodSearchResult[]>([]);
  const [familyError, setFamilyError] = useState('');
  const [familySuccessMsg, setFamilySuccessMsg] = useState('');
  const [showBatchModal, setShowBatchModal] = useState(false);

  // McDonald's Search state
  const [mcdKeyword, setMcdKeyword] = useState('');
  const [isMcdSearching, setIsMcdSearching] = useState(false);
  const [isMcdCrawlingAll, setIsMcdCrawlingAll] = useState(false);
  const [mcdResults, setMcdResults] = useState<FoodSearchResult[]>([]);
  const [mcdError, setMcdError] = useState('');
  const [mcdSuccessMsg, setMcdSuccessMsg] = useState('');

  // Subway Search state
  const [subwayKeyword, setSubwayKeyword] = useState('');
  const [isSubwaySearching, setIsSubwaySearching] = useState(false);
  const [isSubwayCrawlingAll, setIsSubwayCrawlingAll] = useState(false);
  const [subwayResults, setSubwayResults] = useState<FoodSearchResult[]>([]);
  const [subwayError, setSubwayError] = useState('');
  const [subwaySuccessMsg, setSubwaySuccessMsg] = useState('');

  const handleMcdCrawlAll = async () => {
    setIsMcdCrawlingAll(true);
    setMcdError('');
    setMcdSuccessMsg('');

    try {
      const res = await fetch('/api/mcd/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crawlAll: true })
      });

      if (!res.ok) {
        throw new Error('一鍵爬取麥當勞全量菜單失敗，請稍後重試');
      }

      const data = await res.json();
      if (data.products && Array.isArray(data.products) && data.products.length > 0) {
        setMcdResults(data.products);
        await McdonaldCacheService.saveMcDonaldFoods(data.products);
        setMcdSuccessMsg(`成功一鍵全量爬取並將 ${data.products.length} 筆麥當勞官方菜單同步至 Firebase 雲端資料庫！`);
      } else {
        setMcdError('未爬取到任何麥當勞品項，請稍後再試。');
      }
    } catch (err: any) {
      console.error('McDonald crawl all error:', err);
      setMcdError(err.message || '一鍵爬取麥當勞時發生未知錯誤');
    } finally {
      setIsMcdCrawlingAll(false);
    }
  };

  const handleLoadMcdFromFirebase = async () => {
    setIsMcdSearching(true);
    setMcdError('');
    setMcdSuccessMsg('');
    try {
      const list = await McdonaldCacheService.getMcdonaldFoodsFromFirestore();
      if (list && list.length > 0) {
        setMcdResults(list);
      }
    } catch (err: any) {
      console.error('Load McDonald from Firebase error:', err);
    } finally {
      setIsMcdSearching(false);
    }
  };

  const handleMcdSearch = async (keywordToSearch?: string) => {
    const query = (keywordToSearch !== undefined ? keywordToSearch : mcdKeyword).trim();
    if (!query) return;

    setIsMcdSearching(true);
    setMcdError('');
    setMcdSuccessMsg('');
    setMcdResults([]);

    try {
      const cached = await McdonaldCacheService.searchMcdonaldFoodsInFirestore(query);
      if (cached && cached.length > 0) {
        setMcdResults(cached);
        setIsMcdSearching(false);
        return;
      }

      const res = await fetch('/api/mcd/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: query })
      });

      if (!res.ok) throw new Error('搜尋麥當勞食品失敗');

      const data = await res.json();
      if (data.products && Array.isArray(data.products)) {
        setMcdResults(data.products);
        McdonaldCacheService.saveMcDonaldFoods(data.products).catch(console.error);
      }
    } catch (err: any) {
      setMcdError(err.message || '搜尋發生錯誤');
    } finally {
      setIsMcdSearching(false);
    }
  };

  const handleSubwayCrawlAll = async () => {
    setIsSubwayCrawlingAll(true);
    setSubwayError('');
    setSubwaySuccessMsg('');

    try {
      const res = await fetch('/api/subway/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crawlAll: true })
      });

      if (!res.ok) throw new Error('一鍵爬取 Subway 全量菜單失敗');

      const data = await res.json();
      if (data.products && Array.isArray(data.products) && data.products.length > 0) {
        setSubwayResults(data.products);
        await SubwayCacheService.saveSubwayFoods(data.products);
        setSubwaySuccessMsg(`成功一鍵爬取並將 ${data.products.length} 筆 Subway 官方菜單同步至 Firebase！`);
      }
    } catch (err: any) {
      setSubwayError(err.message || '一鍵爬取 Subway 時發生未知錯誤');
    } finally {
      setIsSubwayCrawlingAll(false);
    }
  };

  const handleLoadSubwayFromFirebase = async () => {
    setIsSubwaySearching(true);
    try {
      const list = await SubwayCacheService.getSubwayFoodsFromFirestore();
      if (list && list.length > 0) setSubwayResults(list);
    } catch (err: any) {
      console.error('Load from Firebase error:', err);
    } finally {
      setIsSubwaySearching(false);
    }
  };

  const handleSubwaySearch = async (keywordToSearch?: string) => {
    const query = (keywordToSearch !== undefined ? keywordToSearch : subwayKeyword).trim();
    if (!query) return;

    setIsSubwaySearching(true);
    setSubwayError('');
    setSubwaySuccessMsg('');
    setSubwayResults([]);

    try {
      const cached = await SubwayCacheService.searchSubwayFoodsInFirestore(query);
      if (cached && cached.length > 0) {
        setSubwayResults(cached);
        setIsSubwaySearching(false);
        return;
      }

      const res = await fetch('/api/subway/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: query })
      });

      if (!res.ok) throw new Error('搜尋 Subway 食品失敗');

      const data = await res.json();
      if (data.products && Array.isArray(data.products)) {
        setSubwayResults(data.products);
        SubwayCacheService.saveSubwayFoods(data.products).catch(console.error);
      }
    } catch (err: any) {
      setSubwayError(err.message || '搜尋 Subway 時發生未知錯誤');
    } finally {
      setIsSubwaySearching(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'FAMILY') {
      if (subStore === 'mcd' && mcdResults.length === 0) handleLoadMcdFromFirebase();
      else if (subStore === 'subway' && subwayResults.length === 0) handleLoadSubwayFromFirebase();
    }
  }, [activeTab, subStore]);

  const handleFamilySearch = async (keywordToSearch?: string) => {
    const query = (keywordToSearch !== undefined ? keywordToSearch : familyKeyword).trim();
    if (!query) return;

    setIsFamilySearching(true);
    setFamilyError('');
    setFamilyResults([]);

    try {
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

      if (!res.ok) throw new Error('搜尋全家食品失敗');

      const data = await res.json();
      if (data.products && Array.isArray(data.products)) {
        const filtered = await FamilyCacheService.setCachedFamilySearch(query, data.products);
        setFamilyResults(filtered);
      }
    } catch (err: any) {
      setFamilyError(err.message || '搜尋發生錯誤');
    } finally {
      setIsFamilySearching(false);
    }
  };

  // Cloud foods state
  const [cloudFoods, setCloudFoods] = useState<FoodSearchResult[]>([]);

  // Saved open foods state
  const [openFoods, setOpenFoods] = useState<FoodSearchResult[]>([]);

  const loadCloudFoods = async (queryStr: string = '') => {
    try {
      const results = await CloudFoodService.fetchCloudFoods(queryStr);
      setCloudFoods(results);
    } catch (e) {
      console.warn('Error loading cloud foods:', e);
    }
  };

  const loadOpenFoods = async (queryStr: string = '') => {
    try {
      const results = await OpenFoodService.fetchSavedOpenFoods(queryStr);
      setOpenFoods(results);
    } catch (e) {
      console.warn('Error loading open foods:', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'ALL' || activeTab === 'CLOUD') loadCloudFoods(searchQuery);
    if (activeTab === 'OPEN_FOOD') loadOpenFoods(searchQuery);
  }, [activeTab, searchQuery]);

  const filteredFoods = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const local = StorageService.searchFoods('');
    let list: FoodSearchResult[] = [];

    if (activeTab === 'ALL') {
      const map = new Map<string, FoodSearchResult>();
      local.forEach((f) => {
        const key = f.barcode ? `bc_${f.barcode}` : `${f.name.toLowerCase()}_${(f.brand || '').toLowerCase()}`;
        map.set(key, f);
      });
      cloudFoods.forEach((cf) => {
        const key = cf.barcode ? `bc_${cf.barcode}` : `${cf.name.toLowerCase()}_${(cf.brand || '').toLowerCase()}`;
        if (!map.has(key)) map.set(key, cf);
      });
      list = Array.from(map.values());
    } else if (activeTab === 'OFFICIAL') {
      list = local.filter(f => f.brand?.includes('衛福部') || f.brand?.includes('官方') || f.id.startsWith('tfda_'));
    } else if (activeTab === 'CUSTOM') {
      list = local.filter(f => f.isUserCustom);
    } else if (activeTab === 'FAMILY') {
      list = familyResults;
    } else if (activeTab === 'OPEN_FOOD') {
      list = openFoods;
    } else if (activeTab === 'CLOUD') {
      list = cloudFoods;
    } else {
      list = local;
    }

    if (!q) return list;
    return list.filter(item => item.name.toLowerCase().includes(q) || item.brand?.toLowerCase().includes(q) || item.barcode?.includes(q));
  }, [cloudFoods, familyResults, activeTab, searchQuery]);

  const handleSearchOnline = async (overrideQuery?: string) => {
    const q = (overrideQuery !== undefined ? overrideQuery : searchQuery).trim();
    if (!q) return;
    try {
      const res = await fetch(`/api/openfoodfacts/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.products || []).map((p: any) => {
          const defaultAmount = p.defaultServingAmount || 100;
          const ratio = defaultAmount / 100;
          return {
            id: p.id.startsWith('off_') ? p.id : `off_${p.id}`,
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
    }
  };

  useEffect(() => {
    if (activeTab === 'OPEN_FOOD' && searchQuery.trim().length >= 1) {
      const timer = setTimeout(() => handleSearchOnline(searchQuery), 400);
      return () => clearTimeout(timer);
    }
  }, [activeTab, searchQuery]);

  const handleBarcodeLookup = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBarcodeLoading(true);
    setBarcodeError('');
    try {
      const localMatch = StorageService.searchFoods('').find((f: FoodSearchResult) => f.barcode === trimmed);
      if (localMatch) {
        onSelectFood(localMatch);
        return;
      }
      const cloudMatch = await CloudFoodService.fetchCloudFoodByBarcode(trimmed);
      if (cloudMatch) {
        onSelectFood(cloudMatch);
        return;
      }
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
            protein: Math.round(p.proteinPer100g * ratio * 10) / 10,
            fat: Math.round(p.fatPer100g * ratio * 10) / 10,
            sugars: Math.round((p.sugarsPer100g || 0) * ratio * 10) / 10,
            fiber: Math.round((p.fiberPer100g || 0) * ratio * 10) / 10,
            sodium: Math.round((p.sodiumPer100g || 0) * ratio * 10) / 10,
            potassium: Math.round((p.potassiumPer100g || 0) * ratio * 10) / 10,
            servingAmount: defaultAmount,
            servingUnit: p.servingUnit || 'g',
            barcode: p.barcode,
          };
          onSelectFood(mapped);
          return;
        }
      }
      setBarcodeError(`查無此商品條碼 (${trimmed})`);
      setNotFoundBarcode(trimmed);
      setShowBarcodeNotFoundModal(true);
    } catch (e: any) {
      setBarcodeError('條碼查詢異常');
    } finally {
      setBarcodeLoading(false);
    }
  };

  const performImageAnalysis = async (base64: string, mime: string) => {
    setAiLoading(true);
    setAiError('');
    setAiProgress(10);
    setAiStatus('正在初始化 AI 辨識系統...');

    try {
      const optimizedBase64 = await optimizeImageForAi(base64, 768, 768, 0.7);
      const aiParams = getAiRequestParams();
      const preferredModel = StorageService.getSelectedAiModel();
      
      const ALLOWED_3X_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
      const targetModel = ALLOWED_3X_MODELS.includes(preferredModel) ? preferredModel : 'gemini-3.8-flash';
      const modelsToTry = [targetModel, ...ALLOWED_3X_MODELS.filter(m => m !== targetModel)];

      let lastResultRes: Response | null = null;
      for (let i = 0; i < modelsToTry.length; i++) {
        const currentModel = modelsToTry[i];
        setAiStatus(`正在嘗試以 ${currentModel} 分析...`);
        setAiProgress(30 + (i * 15));
        try {
          const res = await fetch('/api/ai/estimate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: optimizedBase64,
              mimeType: 'image/jpeg',
              customApiKey: aiParams.customApiKey,
              apiKeySource: aiParams.apiKeySource,
              model: currentModel,
              disableFallback: true
            }),
          });
          if (res.ok) {
            lastResultRes = res;
            break;
          }
        } catch (err) {
          if (i === modelsToTry.length - 1) throw err;
        }
      }

      if (!lastResultRes) throw new Error('AI 伺服器忙碌中');

      const result = await lastResultRes.json();
      const defaultAmount = Number(result.defaultServingAmount) || 200;
      const ratio = defaultAmount / 100;
      const foodItem: FoodSearchResult = {
        id: 'ai_photo_' + Date.now(),
        name: result.name || '相片辨識料理',
        brand: result.brand || 'AI辨識',
        calories: Math.round(Number(result.caloriesPer100g) * ratio * 10) / 10,
        carbs: Math.round(Number(result.carbsPer100g) * ratio * 10) / 10,
        protein: Math.round(Number(result.proteinPer100g) * ratio * 10) / 10,
        fat: Math.round(Number(result.fatPer100g) * ratio * 10) / 10,
        sugars: Math.round(Number(result.sugarsPer100g || 0) * ratio * 10) / 10,
        fiber: Math.round(Number(result.fiberPer100g || 0) * ratio * 10) / 10,
        sodium: Math.round(Number(result.sodiumPer100g || 0) * ratio * 10) / 10,
        potassium: Math.round(Number(result.potassiumPer100g || 0) * ratio * 10) / 10,
        servingAmount: defaultAmount,
        servingUnit: result.servingUnit || 'g',
        aiSource: 'vision',
      };
      onSelectFood(foodItem);
    } catch (e: any) {
      setAiError(e.message || 'AI 辨識失敗');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiTextAnalyze = async () => {
    if (!checkAiKeyOrWarn()) return;
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiError('');
    setAiProgress(20);
    setAiStatus('正在由 AI 營養師估算中...');
    
    try {
      const aiParams = getAiRequestParams();
      const preferredModel = StorageService.getSelectedAiModel();
      const ALLOWED_3X_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite'];
      const targetModel = ALLOWED_3X_MODELS.includes(preferredModel) ? preferredModel : 'gemini-3.1-flash-lite';

      const res = await fetch('/api/ai/estimate-nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: aiPrompt.trim(), 
          customApiKey: aiParams.customApiKey,
          apiKeySource: aiParams.apiKeySource,
          model: targetModel,
        }),
      });

      if (!res.ok) throw new Error('估算失敗');
      const result = await res.json();
      const defaultAmount = Number(result.defaultServingAmount) || 100;
      const ratio = defaultAmount / 100;
      const foodItem: FoodSearchResult = {
        id: 'ai_' + Date.now(),
        name: result.name || aiPrompt.trim(),
        brand: result.brand || 'AI辨識',
        calories: Math.round(Number(result.caloriesPer100g) * ratio * 10) / 10,
        carbs: Math.round(Number(result.carbsPer100g) * ratio * 10) / 10,
        protein: Math.round(Number(result.proteinPer100g) * ratio * 10) / 10,
        fat: Math.round(Number(result.fatPer100g) * ratio * 10) / 10,
        sugars: Math.round(Number(result.sugarsPer100g || 0) * ratio * 10) / 10,
        fiber: Math.round(Number(result.fiberPer100g || 0) * ratio * 10) / 10,
        sodium: Math.round(Number(result.sodiumPer100g || 0) * ratio * 10) / 10,
        potassium: Math.round(Number(result.potassiumPer100g || 0) * ratio * 10) / 10,
        servingAmount: defaultAmount,
        servingUnit: result.servingUnit || 'g',
        aiSource: 'estimation',
      };
      onSelectFood(foodItem);
    } catch (e: any) {
      setAiError(e.message || 'AI 估算失敗');
    } finally {
      setAiLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!checkAiKeyOrWarn()) return;
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setSelectedImageBase64(base64);
      await performImageAnalysis(base64, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = originalStyle; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl h-[94dvh] sm:h-[85vh] rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 duration-300">
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
                    onClick={() => { setSelectedMealType(m.type); setShowMealSelector(false); }}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition ${selectedMealType === m.type ? 'bg-sky-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Mode Toggle */}
        <div className="p-4 border-b border-slate-100 flex gap-2">
          <button onClick={() => setActiveTab('ALL')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${activeTab === 'ALL' || activeTab === 'OPEN_FOOD' || activeTab === 'OFFICIAL' || activeTab === 'CUSTOM' || activeTab === 'CLOUD' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <Search className="w-4 h-4" /> 一般搜尋
          </button>
          <button onClick={() => { if (checkAiKeyOrWarn()) setActiveTab('AI_SCAN'); }} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${activeTab === 'AI_SCAN' || activeTab === 'BARCODE' ? 'bg-purple-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <Sparkles className="w-4 h-4" /> AI搜尋
          </button>
          <button onClick={() => setActiveTab('FAMILY')} className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${activeTab === 'FAMILY' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <Store className="w-4 h-4" /> 進階搜尋
          </button>
        </div>

        {/* Conditional Search Bar */}
        {(activeTab === 'ALL' || activeTab === 'OPEN_FOOD' || activeTab === 'OFFICIAL' || activeTab === 'CUSTOM' || activeTab === 'CLOUD') && (
          <div className="px-4 pt-3 pb-2">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5" />
              <input type="text" placeholder="搜尋食品..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-10 py-2.5 bg-slate-100 rounded-2xl text-sm focus:outline-sky-600" />
            </div>
          </div>
        )}

        <div ref={contentBodyRef} className="flex-1 overflow-y-auto p-4">
          {activeTab === 'FAMILY' && (
            <StoreSearchSection
              subStore={subStore} setSubStore={setSubStore}
              keyword={subStore === 'family' ? familyKeyword : subStore === 'mcd' ? mcdKeyword : subwayKeyword}
              setKeyword={subStore === 'family' ? setFamilyKeyword : subStore === 'mcd' ? setMcdKeyword : setSubwayKeyword}
              onSearch={subStore === 'family' ? handleFamilySearch : subStore === 'mcd' ? handleMcdSearch : handleSubwaySearch}
              isSearching={subStore === 'family' ? isFamilySearching : subStore === 'mcd' ? isMcdSearching : isSubwaySearching}
              results={subStore === 'family' ? familyResults : subStore === 'mcd' ? mcdResults : subwayResults}
              error={subStore === 'family' ? familyError : subStore === 'mcd' ? mcdError : subwayError}
              successMsg={subStore === 'family' ? familySuccessMsg : subStore === 'mcd' ? mcdSuccessMsg : subwaySuccessMsg}
              onSelectFood={onSelectFood} onFastAdd={handleFastAdd} addedIds={addedIds} isAdmin={isAdmin}
              onCrawlAll={subStore === 'mcd' ? handleMcdCrawlAll : subStore === 'subway' ? handleSubwayCrawlAll : undefined}
              isCrawlingAll={subStore === 'mcd' ? isMcdCrawlingAll : subStore === 'subway' ? isSubwayCrawlingAll : false}
            />
          )}

          {activeTab === 'AI_SCAN' && (
            <AiAnalysisSection
              aiPrompt={aiPrompt} setAiPrompt={setAiPrompt} onTextAnalyze={handleAiTextAnalyze}
              aiLoading={aiLoading} aiProgress={aiProgress} aiStatus={aiStatus} aiError={aiError}
              onCameraOpen={() => setIsAiCameraModalOpen(true)} onGalleryOpen={() => galleryInputRef.current?.click()} onRetry={retryAction}
            />
          )}

          {activeTab === 'BARCODE' && (
            <BarcodeSection
              barcodeInput={barcodeInput} setBarcodeInput={setBarcodeInput} onLookup={handleBarcodeLookup}
              isLoading={barcodeLoading} error={barcodeError} onOpenScanner={() => setIsScannerModalOpen(true)}
            />
          )}

          {(activeTab === 'ALL' || activeTab === 'OPEN_FOOD' || activeTab === 'OFFICIAL' || activeTab === 'CUSTOM' || activeTab === 'CLOUD') && (
            <div className="space-y-6">
              {!searchQuery && <RecentHistorySection records={filteredHistoryRecords} onQuickAdd={handleQuickAddHistory} onSelect={handleSelectFoodWithHistory} animatingId={animatingHistoryId} formatTime={formatHistoryTime} mapRecordToSearch={mapRecordToSearchResult} selectedMealName={selectedMealName} />}
              <div className="space-y-2.5">
                {filteredFoods.map(food => <FoodResultItem key={food.id} food={food} isAdded={!!addedIds[food.id]} onSelect={onSelectFood} onFastAdd={handleFastAdd} />)}
                {filteredFoods.length === 0 && <div className="py-12 text-center bg-slate-50 rounded-3xl border-dashed border border-slate-200">找不到相符項目</div>}
              </div>
            </div>
          )}
        </div>

        <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

        {isScannerModalOpen && (
          <BarcodeScannerModal isOpen={isScannerModalOpen} onClose={() => setIsScannerModalOpen(false)} onDetected={(code) => { setBarcodeInput(code); setIsScannerModalOpen(false); handleBarcodeLookup(code); }} />
        )}

        {isAiCameraModalOpen && (
          <AiCameraModal isOpen={isAiCameraModalOpen} onClose={() => setIsAiCameraModalOpen(false)} onCaptured={(base64, mime) => { setSelectedImageBase64(base64); performImageAnalysis(base64, mime); }} />
        )}

        {fastAddNotice && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900/90 text-white px-4 py-2 rounded-xl shadow-xl font-bold text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <Check className="w-4 h-4 text-emerald-400" /> <span>{fastAddNotice}</span>
          </div>
        )}

        {showBarcodeNotFoundModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-[32px] p-6 max-w-sm w-full shadow-2xl space-y-4">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto text-blue-600"><Barcode className="w-8 h-8" /></div>
              <div className="text-center">
                <h3 className="text-lg font-black">找不到此條碼</h3>
                <p className="text-xs text-slate-500">目前資料庫尚無條碼 {notFoundBarcode} 的資料。</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowBarcodeNotFoundModal(false); onOpenCustomFoodModal(notFoundBarcode); onClose(); }} className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold">建立自訂飲食</button>
                <button onClick={() => setShowBarcodeNotFoundModal(false)} className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">取消</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
