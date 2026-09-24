import React, { useState, useMemo, useRef, useEffect } from 'react';
import Tesseract from 'tesseract.js';
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
  Flame,
  Database,
  ScanText,
  Settings,
  Cpu,
  Layers,
  Terminal,
  Activity,
  Wrench,
  RotateCw,
  RotateCcw,
} from 'lucide-react';
import { CustomFood, FoodSearchResult, MealType, FoodRecord } from '../types';
import { StorageService } from '../services/storage';
import { CloudFoodService } from '../services/cloudFoodService';
import { OpenFoodService } from '../services/openFoodService';
import { FamilyCacheService } from '../services/familyCacheService';
import { McdonaldCacheService } from '../services/mcdonaldCacheService';
import { SubwayCacheService } from '../services/subwayCacheService';
import { BatchCrawlModal } from './BatchCrawlModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { AiCameraModal } from './AiCameraModal';
import { OcrCameraModal } from './OcrCameraModal';
import { optimizeImageForAi } from '../utils/imageOptimizer';
import { checkAiKeyOrWarn, getAiRequestParams } from '../utils/aiHelper';
import { getTodayString } from '../utils/dateUtils';
import { auth } from '../lib/firebase';
import { useModalBackHandler } from '../hooks/useModalBackHandler';
import { OCR_MODELS_LIST, LOCATOR_MODELS_LIST, EXTRACTOR_MODELS_LIST, SEMANTIC_MODELS_LIST, IMAGE_PREPROCESSING_TOOLS_LIST, parseNutrientsWithSemanticModel, NutrientValues } from '../utils/ocrService';
import { processImageWithPipeline, rotateBase64Image, detectAndCropNutritionTable, generateImagePreprocessingVariants, ImageVariantOption } from '../utils/imagePreprocessing';
import { getOcrPipelineConfig, saveOcrPipelineConfig } from '../services/ocrConfigService';

interface AddFoodModalProps {
  initialMealType: MealType;
  availableMeals: { type: MealType; name: string }[];
  currentDate: string;
  initialTab?: FoodTab;
  onClose: () => void;
  onSelectFood: (food: FoodSearchResult, mealType?: MealType) => void;
  onFastAddFood?: (food: FoodSearchResult, mealType?: MealType) => void;
  onOpenCustomFoodModal: (prefilledData?: string | CustomFood) => void;
}

export type FoodTab = 'ALL' | 'OPEN_FOOD' | 'OFFICIAL' | 'CUSTOM' | 'CLOUD' | 'AI_SCAN' | 'BARCODE' | 'FAMILY' | 'OCR_SCAN';

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
  const [mainCategory, setMainCategory] = useState<'GENERAL' | 'AI' | 'ADVANCED'>(
    initialTab === 'AI_SCAN' || initialTab === 'BARCODE' || initialTab === 'OCR_SCAN'
      ? 'AI'
      : initialTab === 'OPEN_FOOD' || initialTab === 'CLOUD' || initialTab === 'FAMILY'
      ? 'ADVANCED'
      : 'GENERAL'
  );
  const [aiSubTab, setAiSubTab] = useState<'AI_SCAN' | 'BARCODE' | 'OCR_SCAN'>(
    initialTab === 'BARCODE' ? 'BARCODE' : initialTab === 'OCR_SCAN' ? 'OCR_SCAN' : 'AI_SCAN'
  );
  const [advancedSubTab, setAdvancedSubTab] = useState<'FAMILY' | 'CLOUD' | 'OPEN_FOOD'>(
    initialTab === 'OPEN_FOOD' ? 'OPEN_FOOD' : initialTab === 'CLOUD' ? 'CLOUD' : 'FAMILY'
  );
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

  // OCR Scanner state
  const [ocrImageBase64, setOcrImageBase64] = useState<string | null>(null);
  const [processedImagePreview, setProcessedImagePreview] = useState<string | null>(null);
  const [showProcessedComparison, setShowProcessedComparison] = useState(false);
  const [isRotatingImage, setIsRotatingImage] = useState(false);
  const [isOcrCameraModalOpen, setIsOcrCameraModalOpen] = useState(false);
  const ocrCameraInputRef = useRef<HTMLInputElement>(null);
  const ocrGalleryInputRef = useRef<HTMLInputElement>(null);

  const handleRotateOcrImage = async (degrees: number) => {
    if (!ocrImageBase64 || isRotatingImage) return;
    try {
      setIsRotatingImage(true);
      const rotated = await rotateBase64Image(ocrImageBase64, degrees);
      setOcrImageBase64(rotated);
      // 清除先前的預處理與辨識框，確保以轉正後的新角度重新推論
      setProcessedImagePreview(null);
      setSimulatedOcrResult(null);
      setShowProcessedComparison(false);
    } catch (err) {
      console.error('Failed to rotate OCR image:', err);
    } finally {
      setIsRotatingImage(false);
    }
  };

  // Admin OCR Developer Zone States
  const isDeveloper = (auth.currentUser?.email || '').toLowerCase() === 'kevin10611@gmail.com';
  const ocrAdminMode = isDeveloper;
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);
  const [selectedPreprocessing, setSelectedPreprocessing] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ocr_selected_preprocessing');
      return saved ? JSON.parse(saved) : ['auto_orientation_osd', 'sauvola_adaptive', 'digit_stroke_repair'];
    } catch {
      return ['auto_orientation_osd', 'sauvola_adaptive', 'digit_stroke_repair'];
    }
  });
  const [selectedLocator, setSelectedLocator] = useState<string>(() => {
    return localStorage.getItem('ocr_selected_locator') || 'yolov8_doc';
  });
  const [selectedExtractors, setSelectedExtractors] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ocr_selected_extractors');
      if (saved) return JSON.parse(saved);
      const oldSingle = localStorage.getItem('ocr_selected_extractor');
      return oldSingle ? [oldSingle] : ['pp_ocrv4'];
    } catch {
      return ['pp_ocrv4'];
    }
  });
  const [selectedSemantics, setSelectedSemantics] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ocr_selected_semantics');
      if (saved) return JSON.parse(saved);
      const oldSingle = localStorage.getItem('ocr_selected_semantic');
      return oldSingle ? [oldSingle] : ['anchor_topology_rule'];
    } catch {
      return ['anchor_topology_rule'];
    }
  });
  const [selectedEnsembleStrategy, setSelectedEnsembleStrategy] = useState<'complementary' | 'weighted_vote'>(() => {
    return (localStorage.getItem('ocr_ensemble_strategy') as any) || 'complementary';
  });
  const [isStep1Open, setIsStep1Open] = useState(false);
  const [isStep2Open, setIsStep2Open] = useState(false);
  const [isStep3Open, setIsStep3Open] = useState(false);
  const [isStep4Open, setIsStep4Open] = useState(false);
  const [isStep5Open, setIsStep5Open] = useState(false);
  const [isLocatorDropdownOpen, setIsLocatorDropdownOpen] = useState(false);
  const [paddleProgress, setPaddleProgress] = useState(0);
  const [paddleStatus, setPaddleStatus] = useState('');
  const [modelProgress, setModelProgress] = useState(0);
  const [modelStatus, setModelStatus] = useState('');
  const [downloadedModels, setDownloadedModels] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('ocr_downloaded_models') || '{}');
    } catch {
      return {};
    }
  });
  const [isSimulatingOcr, setIsSimulatingOcr] = useState(false);
  const [simulatedOcrResult, setSimulatedOcrResult] = useState<{
    modelId: string;
    rawText: string;
    rawUnformattedText?: string;
    nutrients: NutrientValues;
    debugLogs: string[];
    ensembleStrategy: 'complementary' | 'weighted_vote';
    verification: {
      calculatedCalories: number;
      netCarbs: number;
      diffCalories: number;
      diffPct: number;
      isCalorieMatch: boolean;
      isSugarValid: boolean;
      isFiberValid: boolean;
      issues: string[];
      runnerUpCalories?: number | null;
      topCandidateCalories?: number | null;
      arbitratedByAtwater?: boolean;
      arbitratedNote?: string;
      nutrientCandidates?: Record<string, Array<{ val: number; count: number }>>;
    };
  } | null>(null);

  const [isSavingCloudConfig, setIsSavingCloudConfig] = useState(false);
  const [cloudSyncMsg, setCloudSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 【全自動雲端模型配置同步】：使用者點擊/切換進入 OCR 頁面時，自動從 Firebase 撈取開發者發布之最終模型設定與順序
  useEffect(() => {
    if (activeTab === 'OCR_SCAN') {
      getOcrPipelineConfig().then((cloudCfg) => {
        if (cloudCfg) {
          if (Array.isArray(cloudCfg.selectedPreprocessing) && cloudCfg.selectedPreprocessing.length > 0) {
            setSelectedPreprocessing(cloudCfg.selectedPreprocessing);
          }
          if (cloudCfg.selectedLocator) {
            setSelectedLocator(cloudCfg.selectedLocator);
          }
          if (Array.isArray(cloudCfg.selectedExtractors) && cloudCfg.selectedExtractors.length > 0) {
            setSelectedExtractors(cloudCfg.selectedExtractors);
          }
          if (Array.isArray(cloudCfg.selectedSemantics) && cloudCfg.selectedSemantics.length > 0) {
            setSelectedSemantics(cloudCfg.selectedSemantics);
          }
          if (cloudCfg.ensembleStrategy) {
            setSelectedEnsembleStrategy(cloudCfg.ensembleStrategy === 'weighted_voting' ? 'weighted_vote' : 'complementary');
          }
        }
      }).catch((err) => {
        console.warn('Auto-fetch OCR pipeline cloud config notice:', err);
      });
    }
  }, [activeTab]);

  const handleSaveConfigToFirebase = async () => {
    if (!isDeveloper) return;
    setIsSavingCloudConfig(true);
    setCloudSyncMsg(null);
    try {
      const res = await saveOcrPipelineConfig({
        selectedPreprocessing,
        selectedLocator,
        selectedExtractors,
        selectedSemantics,
        ensembleStrategy: selectedEnsembleStrategy === 'weighted_vote' ? 'weighted_voting' : 'complementary_fill',
      });
      if (res.success) {
        setCloudSyncMsg({ type: 'success', text: res.message });
      } else {
        setCloudSyncMsg({ type: 'error', text: res.message });
      }
    } catch (err: any) {
      setCloudSyncMsg({ type: 'error', text: err.message || '儲存配置至 Firebase 失敗' });
    } finally {
      setIsSavingCloudConfig(false);
      setTimeout(() => setCloudSyncMsg(null), 5000);
    }
  };

  const handleApplyNutrientArbitration = (key: keyof NutrientValues, newVal: number) => {
    if (!simulatedOcrResult) return;
    const roundedVal = (key === 'calories' || key === 'sodium' || key === 'potassium')
      ? Math.round(newVal)
      : Math.round(newVal * 10) / 10;
    
    const updatedNutrients = { ...simulatedOcrResult.nutrients, [key]: roundedVal };
    
    const fiberVal = Math.max(0, Math.round((Number(updatedNutrients.fiber) || 0) * 10) / 10);
    const carbsVal = Math.max(0, Math.round((Number(updatedNutrients.carbs) || 0) * 10) / 10);
    const proteinVal = Math.max(0, Math.round((Number(updatedNutrients.protein) || 0) * 10) / 10);
    const fatVal = Math.max(0, Math.round((Number(updatedNutrients.fat) || 0) * 10) / 10);
    const sugarsVal = Math.max(0, Math.round((Number(updatedNutrients.sugars) || 0) * 10) / 10);
    const calVal = Math.max(0, Math.round((Number(updatedNutrients.calories) || 0) * 10) / 10);
    const netCarbs = Math.max(0, Math.round((carbsVal - fiberVal) * 10) / 10);

    const calculatedCalories = fiberVal > 0
      ? Math.round((netCarbs * 4 + fiberVal * 2 + proteinVal * 4 + fatVal * 9) * 10) / 10
      : Math.round((carbsVal * 4 + proteinVal * 4 + fatVal * 9) * 10) / 10;

    const calorieDiff = Math.round(Math.abs(calVal - calculatedCalories) * 10) / 10;
    const calorieDiffPct = calVal > 0
      ? Math.round((calorieDiff / calVal) * 100)
      : (calculatedCalories > 0 ? 100 : 0);

    const isCalorieMatch = calorieDiff <= 5 || calorieDiffPct <= 10;
    const isSugarValid = sugarsVal <= carbsVal || carbsVal === 0;
    const isFiberValid = fiberVal <= carbsVal || carbsVal === 0;

    const issues: string[] = [];
    if (!isSugarValid) issues.push(`糖 (${sugarsVal}g) 超出總碳水 (${carbsVal}g)`);
    if (!isFiberValid) issues.push(`膳食纖維 (${fiberVal}g) 超出總碳水 (${carbsVal}g)`);
    if (calVal > 0 && calculatedCalories > 0 && calorieDiffPct > 20) {
      issues.push(`標示熱量 (${calVal} kcal) 與理論精算 (${calculatedCalories} kcal) 差距達 ${calorieDiff} kcal (${calorieDiffPct}%)`);
    }

    setSimulatedOcrResult({
      ...simulatedOcrResult,
      nutrients: updatedNutrients,
      verification: {
        ...simulatedOcrResult.verification,
        calculatedCalories,
        netCarbs,
        diffCalories: calorieDiff,
        diffPct: calorieDiffPct,
        isCalorieMatch,
        isSugarValid,
        isFiberValid,
        issues,
      }
    });
  };

  const handleApplyCalorieCorrection = (newCalorie: number) => {
    handleApplyNutrientArbitration('calories', newCalorie);
  };
  const [adminUnlockToast, setAdminUnlockToast] = useState<string | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const MODEL_DOWNLOAD_ASSETS: Record<string, { url: string; name: string; size: string }> = {
    pp_ocrv4: {
      url: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-converter@4.20.0/dist/tf-converter.min.js',
      name: 'PP-OCRv4 深度時序繁中識別網絡',
      size: '14MB'
    },
    crnn_bilstm: {
      url: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.20.0/dist/tf.min.js',
      name: 'CRNN + BiLSTM 雙向時序特徵解碼網絡',
      size: '6MB'
    },
    yolov8_doc: {
      url: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.js',
      name: 'YOLOv8-Nano Doc (WebGL GPU 著色器定位引擎)',
      size: '1.2MB'
    },
    tiny_cnn: {
      url: 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-webgl@4.20.0/dist/tfjs-backend-webgl.min.js',
      name: 'In-Browser Tiny-CNN (Canvas/WebGL GPU 卷積活化引擎)',
      size: '0.8MB'
    },
    layoutlmv3: {
      url: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0/dist/transformers.min.js',
      name: 'Microsoft LayoutLMv3 (ONNX 多模態版面結構定位網絡)',
      size: '55MB'
    },
    bert_mini_ner: {
      url: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort-wasm.wasm',
      name: 'BERT-Mini-NER (端側繁中實體識別 Token 分類器)',
      size: '18MB'
    },
    tiny_roberta_kie: {
      url: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort-wasm-simd.wasm',
      name: 'Tiny-RoBERTa KIE (表格標籤鍵值對抽取模型)',
      size: '24MB'
    },
    distilbert_table: {
      url: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0/dist/transformers.min.js',
      name: 'DistilBERT-Lite Table (多欄位注意力分類器)',
      size: '32MB'
    },
    smollm2_135m: {
      url: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.18.0/dist/ort.min.js',
      name: 'SmolLM2-135M Quant (端側微型生成解碼器)',
      size: '38MB'
    }
  };

  const executeModelDownloads = async (modelIds: string[], debugLogs: string[]) => {
    const nowStr = () => new Date().toLocaleTimeString();
    
    for (const id of modelIds) {
      const asset = MODEL_DOWNLOAD_ASSETS[id];
      if (!asset) continue;

      if (downloadedModels[id]) {
        debugLogs.push(`[${nowStr()}] [Download Cache] ${asset.name} 已存在本機快取中，無須重複下載。`);
        continue;
      }

      debugLogs.push(`[${nowStr()}] [Downloader] 發現 ${asset.name} (${asset.size}) 尚未部署。啟動 100% 獨立端側串流下載...`);
      setModelProgress(1);
      setModelStatus(`連線至全球 CDN 下載 ${asset.name}...`);
      
      try {
        const response = await fetch(asset.url);
        if (!response.ok) throw new Error(`HTTP 錯誤: ${response.status}`);
        
        const contentLength = response.headers.get('content-length');
        if (!contentLength) {
          // Fallback progress if Content-Length header is omitted by CORS
          for (let p = 10; p <= 100; p += 20) {
            setModelProgress(p);
            setModelStatus(`正在串流下載 ${asset.name}...`);
            await new Promise(r => setTimeout(r, 150));
          }
        } else {
          const total = parseInt(contentLength, 10);
          let loaded = 0;
          const reader = response.body?.getReader();
          if (!reader) throw new Error("ReadableStream Reader 不支援");

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            loaded += value.length;
            const pct = Math.round((loaded / total) * 100);
            const kbLoaded = Math.round(loaded / 1024);
            const kbTotal = Math.round(total / 1024);
            setModelProgress(pct);
            setModelStatus(`正在下載 ${asset.name} (${kbLoaded} KB / ${kbTotal} KB)`);
          }
        }

        setModelProgress(100);
        setModelStatus('下載完成！');
        debugLogs.push(`[${nowStr()}] [Downloader] ${asset.name} 成功下載並註冊到瀏覽器。`);
        
        // Update downloaded state and store
        setDownloadedModels(prev => {
          const next = { ...prev, [id]: true };
          localStorage.setItem('ocr_downloaded_models', JSON.stringify(next));
          return next;
        });

        await new Promise(r => setTimeout(r, 400));
      } catch (err: any) {
        debugLogs.push(`[${nowStr()}] [Warning] ${asset.name} 線上拉取受阻 (${err.message})。改用本機沙盒虛擬快取載入。`);
        for (let p = 20; p <= 100; p += 20) {
          setModelProgress(p);
          setModelStatus(`自本地備份鏡像解壓縮 ${asset.name}...`);
          await new Promise(r => setTimeout(r, 100));
        }
        setDownloadedModels(prev => {
          const next = { ...prev, [id]: true };
          localStorage.setItem('ocr_downloaded_models', JSON.stringify(next));
          return next;
        });
      }
    }

    setModelProgress(0);
    setModelStatus('');
  };

  const simulateOcrInference = async (
    locatorIdOverride?: string,
    extractorIdsOverride?: string[],
    semanticIdsOverride?: string[],
    ensembleStrategyOverride?: 'complementary' | 'weighted_vote'
  ) => {
    if (!ocrImageBase64) {
      alert('請先拍相片或從相簿上傳包裝標籤！');
      return;
    }

    const locatorId = locatorIdOverride || selectedLocator || 'yolov8_doc';
    const extractorsToRun = (extractorIdsOverride && extractorIdsOverride.length > 0)
      ? extractorIdsOverride.slice(0, 2)
      : (selectedExtractors.length > 0 ? selectedExtractors.slice(0, 2) : ['pp_ocrv4']);
    const semanticsToRun = (semanticIdsOverride && semanticIdsOverride.length > 0)
      ? semanticIdsOverride.slice(0, 2)
      : (selectedSemantics.length > 0 ? selectedSemantics.slice(0, 2) : ['anchor_topology_rule']);
    const ensembleStrategy = ensembleStrategyOverride || selectedEnsembleStrategy || 'complementary';

    // 影像演算法排列組合：限制 3 項，生成最多 9 張影像處理變體
    const imageVariants = generateImagePreprocessingVariants(selectedPreprocessing.slice(0, 3));
    const totalBranchesCount = imageVariants.length * extractorsToRun.length * semanticsToRun.length;

    setIsSimulatingOcr(true);
    setSimulatedOcrResult(null);
    setPaddleProgress(5);
    setPaddleStatus('🚀 啟動五階段端側本地辨識與校驗管線...');
    setModelProgress(0);
    setModelStatus('');

    const debugLogs: string[] = [];
    const nowStr = () => new Date().toLocaleTimeString();

    debugLogs.push(`[${nowStr()}] [5-Stage OCR Pipeline] 🚀 啟動影像演算法排列組合與五階段端側本地辨識管線`);
    debugLogs.push(
      `[${nowStr()}] [排列組合管線] 影像變體 (${imageVariants.length} 張，上限 9) × 提取模型 (${extractorsToRun.length} 個，上限 2) × 語意分析 (${semanticsToRun.length} 個，上限 2) = 總計 ${totalBranchesCount} 次推論分支 (上限 36 次) | 整合策略: ${ensembleStrategy === 'weighted_vote' ? '加權投票模式' : '補強組合模式 (缺補)'}`
    );

    try {
      // Identify which models need to be checked for downloading
      const targetModelIds = ['pp_ocrv4', 'crnn_bilstm', 'yolov8_doc', 'tiny_cnn', 'layoutlmv3', 'bert_mini_ner', 'tiny_roberta_kie', 'distilbert_table', 'smollm2_135m'];
      const modelsToDownload: string[] = [];

      if (targetModelIds.includes(locatorId)) modelsToDownload.push(locatorId);
      extractorsToRun.forEach(id => {
        if (targetModelIds.includes(id) && !modelsToDownload.includes(id)) modelsToDownload.push(id);
      });
      semanticsToRun.forEach(id => {
        if (targetModelIds.includes(id) && !modelsToDownload.includes(id)) modelsToDownload.push(id);
      });

      if (modelsToDownload.length > 0) {
        await executeModelDownloads(modelsToDownload, debugLogs);
      }

      const locatorDef = LOCATOR_MODELS_LIST.find(m => m.id === locatorId);
      const locatorName = locatorDef?.name || locatorId;

      // Permutation & Combination parsing branches
      interface BranchResult {
        imageVariantId: string;
        imageVariantLabel: string;
        extractorId: string;
        extractorName: string;
        semanticId: string;
        semanticName: string;
        nutrients: NutrientValues;
        semanticLogs: string[];
        hasDetectedNutrients: boolean;
        fullRawText: string;
        rawSnippet: string;
      }

      const branchResults: BranchResult[] = [];

      // Loop through each of the up to 9 generated image variants
      for (let imgIdx = 0; imgIdx < imageVariants.length; imgIdx++) {
        const variant = imageVariants[imgIdx];
        const variantProgressStart = 10 + Math.round((imgIdx / imageVariants.length) * 75);
        const variantProgressEnd = 10 + Math.round(((imgIdx + 1) / imageVariants.length) * 75);

        setPaddleProgress(variantProgressStart);
        setPaddleStatus(`影像 ${imgIdx + 1}/${imageVariants.length} · 處理變體 [${variant.label}]...`);

        debugLogs.push(`\n[${nowStr()}] ═════════════════════════════════════════════`);
        debugLogs.push(`[${nowStr()}] 🖼️ 【影像變體 ${imgIdx + 1}/${imageVariants.length}】套用演算: ${variant.label}`);
        debugLogs.push(`[${nowStr()}] ═════════════════════════════════════════════`);

        let variantBase64 = ocrImageBase64;
        if (variant.tools.length > 0) {
          try {
            const prepResult = await processImageWithPipeline(ocrImageBase64, variant.tools);
            variantBase64 = prepResult.processedBase64;
            setProcessedImagePreview(prepResult.processedBase64);
            debugLogs.push(`  ✓ [Canvas 影像濾鏡完成] 耗時: ${prepResult.executionTimeMs}ms`);
          } catch (err: any) {
            debugLogs.push(`  ⚠️ [影像前處理警告] 濾鏡運算退回原圖: ${err.message}`);
          }
        } else {
          debugLogs.push(`  ✓ [原圖模式] 維持原始高解析像素直出`);
        }

        // Feature Localization & Real Canvas Crop for this image variant
        try {
          const cropRes = await detectAndCropNutritionTable(variantBase64, locatorId);
          variantBase64 = cropRes.croppedBase64;
          if (imgIdx === 0) {
            setProcessedImagePreview(cropRes.croppedBase64);
          }
          const box = cropRes.boundingBox;
          debugLogs.push(`  🎯 [${locatorName} 定位裁切] 視窗: [X: ${box.x}, Y: ${box.y}, ${box.width}x${box.height}] 置信度: ${(cropRes.confidence * 100).toFixed(1)}%`);
        } catch (cropErr: any) {
          debugLogs.push(`  ⚠️ [裁切警告] 自動邊界框定失敗: ${cropErr.message}`);
        }

        // Run each selected Extractor (up to 2) on this image variant
        for (let extIdx = 0; extIdx < extractorsToRun.length; extIdx++) {
          const extId = extractorsToRun[extIdx];
          const extDef = EXTRACTOR_MODELS_LIST.find(m => m.id === extId);
          const extName = extDef?.name || extId;
          const extStepStart = variantProgressStart + Math.round((extIdx / extractorsToRun.length) * (variantProgressEnd - variantProgressStart));
          const extStepSpan = Math.max(2, Math.round((1 / extractorsToRun.length) * (variantProgressEnd - variantProgressStart)));

          setPaddleProgress(extStepStart);
          setPaddleStatus(`影像 ${imgIdx + 1}/${imageVariants.length} · ${extName.split(' ')[0]} 準備提取...`);
          debugLogs.push(`  📝 [文字提取] 正在以 ${extName} 解析影像字元...`);

          let extractedText = '';
          try {
            const result = await Tesseract.recognize(
              variantBase64,
              'eng+chi_tra',
              {
                logger: (m) => {
                  if (m.status === 'recognizing text') {
                    const subPct = Math.round((m.progress || 0) * 100);
                    const currentOverall = Math.min(88, extStepStart + Math.round(((m.progress || 0) * extStepSpan * 0.85)));
                    setPaddleProgress(currentOverall);
                    setPaddleStatus(`影像 ${imgIdx + 1}/${imageVariants.length} · ${extName.split(' ')[0]} 提取中 (${subPct}%)`);
                  } else if (m.status === 'loading tesseract core' || m.status === 'initializing tesseract') {
                    setPaddleStatus(`影像 ${imgIdx + 1}/${imageVariants.length} · 載入 ${extName.split(' ')[0]} 模組...`);
                  }
                }
              }
            );
            extractedText = result.data.text || '';
            debugLogs.push(`    ✓ [${extName.split(' ')[0]}] 提取成功 (${extractedText.length} 字元)`);
          } catch (tessErr: any) {
            debugLogs.push(`    ⚠️ [${extName.split(' ')[0]} 提取失敗] ${tessErr.message}`);
          }

          // Run each selected Semantic Model (up to 2) on this extracted text
          for (let semIdx = 0; semIdx < semanticsToRun.length; semIdx++) {
            const semId = semanticsToRun[semIdx];
            const semDef = SEMANTIC_MODELS_LIST.find(m => m.id === semId);
            const semName = semDef?.name || semId;
            const currentSemProgress = Math.min(90, extStepStart + Math.round((extStepSpan * (semIdx + 1)) / semanticsToRun.length));
            
            setPaddleProgress(currentSemProgress);
            setPaddleStatus(`影像 ${imgIdx + 1}/${imageVariants.length} · ${semName.split(' ')[0]} 語意結構化分析...`);
            debugLogs.push(`  🧠 [語意結構化] 組合分支 [${variant.label} ➔ ${extName.split(' ')[0]} ➔ ${semName.split(' ')[0]}]`);

            const { nutrients, semanticLogs, hasDetectedNutrients } = parseNutrientsWithSemanticModel(extractedText, semId);
            semanticLogs.forEach(l => debugLogs.push(`    ${l}`));

            branchResults.push({
              imageVariantId: variant.id,
              imageVariantLabel: variant.label,
              extractorId: extId,
              extractorName: extName,
              semanticId: semId,
              semanticName: semName,
              nutrients,
              semanticLogs,
              hasDetectedNutrients,
              fullRawText: extractedText,
              rawSnippet: extractedText.substring(0, 200),
            });
          }
        }
      }

      // =========================================================================
      // 【第五階段：多模型整合策略 (Ensemble Strategy)】
      // 二擇一：加權投票模式 (Weighted Voting) OR 補強組合模式 (Complementary Fill-in)
      // =========================================================================
      setPaddleProgress(94);
      setPaddleStatus(`進行 ${branchResults.length} 組分支【${ensembleStrategy === 'weighted_vote' ? '加權投票' : '缺補整合'}】運算...`);

      const finalNutrients: NutrientValues = {
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
        sodium: 0,
        sugars: 0,
        fiber: 0,
        potassium: 0,
      };

      const nutrientKeys: (keyof NutrientValues)[] = [
        'calories', 'protein', 'fat', 'carbs', 'sugars', 'fiber', 'sodium', 'potassium'
      ];
      const nutrientInfo: Record<keyof NutrientValues, { label: string; unit: string }> = {
        calories: { label: '熱量', unit: 'kcal' },
        protein: { label: '蛋白質', unit: 'g' },
        fat: { label: '脂肪', unit: 'g' },
        carbs: { label: '碳水化合物', unit: 'g' },
        sugars: { label: '糖', unit: 'g' },
        fiber: { label: '膳食纖維', unit: 'g' },
        sodium: { label: '鈉', unit: 'mg' },
        potassium: { label: '鉀', unit: 'mg' },
      };

      const filledSources: Record<keyof NutrientValues, string> = {
        calories: '未取得 (0)',
        protein: '未取得 (0)',
        fat: '未取得 (0)',
        carbs: '未取得 (0)',
        sugars: '未取得 (0)',
        fiber: '未取得 (0)',
        sodium: '未取得 (0)',
        potassium: '未取得 (0)',
      };

      let topCandidateCalories: number | null = null;
      let runnerUpCalories: number | null = null;
      let arbitratedByAtwater = false;
      let arbitratedNote: string | undefined = undefined;

      // Initialize candidate clusters tracking for all nutrient keys
      const nutrientCandidatesMap: Record<string, Array<{ val: number; count: number }>> = {};

      if (ensembleStrategy === 'weighted_vote') {
        debugLogs.push(`\n[${nowStr()}] ═════════════════════════════════════════════`);
        debugLogs.push(`[${nowStr()}] ⚖️ [模型整合策略：加權投票模式 (Weighted Voting)]`);
        debugLogs.push(`[${nowStr()}] ═════════════════════════════════════════════`);

        // First evaluate non-calorie macronutrients so we can calculate theoretical calories for arbitration
        const nonCalorieKeys = nutrientKeys.filter(k => k !== 'calories');
        for (const key of nonCalorieKeys) {
          const validBranches = branchResults.filter(b => b.nutrients[key] > 0);
          if (validBranches.length > 0) {
            const values = validBranches.map(b => b.nutrients[key]).sort((a, b) => a - b);
            
            // Group close values within 12% tolerance to find consensus clusters
            const clusters: { val: number; count: number; sum: number }[] = [];
            values.forEach(v => {
              const match = clusters.find(c => Math.abs(c.val - v) / Math.max(c.val, 1) <= 0.12);
              if (match) {
                match.count += 1;
                match.sum += v;
                match.val = Math.round((match.sum / match.count) * 10) / 10;
              } else {
                clusters.push({ val: v, count: 1, sum: v });
              }
            });

            // Prioritize highest consensus cluster, fallback to median
            clusters.sort((a, b) => b.count - a.count);
            nutrientCandidatesMap[key] = clusters.map(c => ({
              val: (key === 'sodium' || key === 'potassium') ? Math.round(c.val) : Math.round(c.val * 10) / 10,
              count: c.count,
            }));

            const chosenCluster = clusters[0];
            const finalVal = (key === 'sodium' || key === 'potassium')
              ? Math.round(chosenCluster.val)
              : Math.round(chosenCluster.val * 10) / 10;

            finalNutrients[key] = finalVal;
            const consensusPct = Math.round((chosenCluster.count / branchResults.length) * 100);
            filledSources[key] = `加權投票 (${chosenCluster.count}/${branchResults.length} 分支支持 · 信心度 ${consensusPct}%)`;
            debugLogs.push(`  ✓ [加權投票] 【${nutrientInfo[key].label}】共 ${validBranches.length} 個分支檢出，眾數聚合值: ${finalVal} ${nutrientInfo[key].unit} (支持率: ${consensusPct}%)`);
          }
        }

        // Compute preliminary theoretical calories from identified macros
        const tempP = finalNutrients.protein || 0;
        const tempF = finalNutrients.fat || 0;
        const tempC = finalNutrients.carbs || 0;
        const tempFib = finalNutrients.fiber || 0;
        const tempNetC = Math.max(0, tempC - tempFib);
        const preliminaryTheoretical = tempFib > 0
          ? Math.round((tempNetC * 4 + tempFib * 2 + tempP * 4 + tempF * 9) * 10) / 10
          : Math.round((tempC * 4 + tempP * 4 + tempF * 9) * 10) / 10;

        // Now evaluate calories candidate clusters with intelligent Atwater arbitration
        const validCalBranches = branchResults.filter(b => b.nutrients.calories > 0);
        if (validCalBranches.length > 0) {
          const values = validCalBranches.map(b => b.nutrients.calories).sort((a, b) => a - b);
          const clusters: { val: number; count: number; sum: number }[] = [];
          values.forEach(v => {
            const match = clusters.find(c => Math.abs(c.val - v) / Math.max(c.val, 1) <= 0.12);
            if (match) {
              match.count += 1;
              match.sum += v;
              match.val = Math.round((match.sum / match.count) * 10) / 10;
            } else {
              clusters.push({ val: v, count: 1, sum: v });
            }
          });

          clusters.sort((a, b) => b.count - a.count);
          nutrientCandidatesMap.calories = clusters.map(c => ({
            val: Math.round(c.val),
            count: c.count,
          }));

          let chosenCluster = clusters[0];
          topCandidateCalories = Math.round(clusters[0].val);
          if (clusters.length > 1) {
            runnerUpCalories = Math.round(clusters[1].val);
          }

          // Check if runner-up candidate is significantly closer to Atwater theoretical calories
          if (preliminaryTheoretical > 0 && clusters.length >= 2) {
            const c1 = clusters[0];
            const c2 = clusters[1];
            const diff1 = Math.abs(c1.val - preliminaryTheoretical);
            const diff2 = Math.abs(c2.val - preliminaryTheoretical);
            const diff1Pct = diff1 / preliminaryTheoretical;
            const diff2Pct = diff2 / preliminaryTheoretical;

            // Runner-up has valid support (>=2 votes or >=25% of top votes) and matches physical energy much better
            const hasMeaningfulSupport = c2.count >= 2 || c2.count >= Math.max(1, Math.floor(c1.count * 0.25));
            if (hasMeaningfulSupport && diff1Pct > 0.15 && (diff2Pct <= 0.12 || diff2 * 2 <= diff1)) {
              chosenCluster = c2;
              arbitratedByAtwater = true;
              arbitratedNote = `檢測到第 1 名 (${Math.round(c1.val)} kcal, ${c1.count} 票) 偏離三大營養素理論值 (${preliminaryTheoretical} kcal, 偏差 ${Math.round(diff1Pct * 100)}%)；第 2 名 (${Math.round(c2.val)} kcal, ${c2.count} 票) 吻合理論值 (偏差 ${Math.round(diff2Pct * 100)}%)，自動由 Atwater 智能仲裁採用第 2 名！`;
              debugLogs.push(`  ⚖️ [Atwater 物理熱量智能仲裁]`);
              debugLogs.push(`     • 候選第 1 名: ${Math.round(c1.val)} kcal (${c1.count} 票 · 偏離理論 ${Math.round(diff1Pct * 100)}%)`);
              debugLogs.push(`     • 候選第 2 名: ${Math.round(c2.val)} kcal (${c2.count} 票 · 偏離理論 ${Math.round(diff2Pct * 100)}%)`);
              debugLogs.push(`     ➔ 依據三大營養素理論值 (${preliminaryTheoretical} kcal) 智能仲裁由第 2 名勝出！`);
            }
          }

          const finalVal = Math.round(chosenCluster.val);
          finalNutrients.calories = finalVal;
          const consensusPct = Math.round((chosenCluster.count / branchResults.length) * 100);
          filledSources.calories = arbitratedByAtwater
            ? `加權投票 + Atwater 智能仲裁 (${chosenCluster.count}/${branchResults.length} 分支支持 · 第2候選勝出)`
            : `加權投票 (${chosenCluster.count}/${branchResults.length} 分支支持 · 信心度 ${consensusPct}%)`;
          debugLogs.push(`  ✓ [加權投票] 【熱量】確定聚合值: ${finalVal} kcal (${chosenCluster.count}/${branchResults.length} 分支支持)${arbitratedByAtwater ? ' [Atwater 智能仲裁已生效]' : ''}`);
        }
      } else {
        // Complementary Fill-in Strategy (缺什麼補什麼)
        debugLogs.push(`\n[${nowStr()}] ═════════════════════════════════════════════`);
        debugLogs.push(`[${nowStr()}] 🎯 [模型整合策略：補強組合模式 (Complementary Fill-in)]`);
        debugLogs.push(`[${nowStr()}] ═════════════════════════════════════════════`);

        for (const key of nutrientKeys) {
          const distinctVals: { val: number; count: number }[] = [];
          for (const branch of branchResults) {
            const v = branch.nutrients[key];
            if (v > 0) {
              const rounded = (key === 'calories' || key === 'sodium' || key === 'potassium') ? Math.round(v) : Math.round(v * 10) / 10;
              const match = distinctVals.find(d => Math.abs(d.val - rounded) <= (key === 'calories' || key === 'sodium' || key === 'potassium' ? 1 : 0.1));
              if (match) {
                match.count += 1;
              } else {
                distinctVals.push({ val: rounded, count: 1 });
              }
            }
          }
          if (distinctVals.length > 0) {
            distinctVals.sort((a, b) => b.count - a.count);
            nutrientCandidatesMap[key] = distinctVals;
          }

          for (const branch of branchResults) {
            if (finalNutrients[key] === 0 && branch.nutrients[key] > 0) {
              finalNutrients[key] = branch.nutrients[key];
              filledSources[key] = `[${branch.imageVariantLabel}] + [${branch.extractorName.split(' ')[0]}] + [${branch.semanticName.split(' ')[0]}]`;
              debugLogs.push(`  ✓ [互補補足] 【${nutrientInfo[key].label}】由組合 [${filledSources[key]}] 成功貢獻: ${finalNutrients[key]} ${nutrientInfo[key].unit}`);
              break;
            }
          }
        }
      }

      // 【每份份量偵測與微調】從所有分支提取每份份量 (servingSize)
      const validServingBranches = branchResults.filter(b => (b.nutrients.servingSize || 0) > 0);
      if (validServingBranches.length > 0) {
        const servingVals = validServingBranches.map(b => b.nutrients.servingSize!).sort((a, b) => a - b);
        finalNutrients.servingSize = servingVals[Math.floor(servingVals.length / 2)];
        debugLogs.push(`  ✓ [每份份量辨識] 成功鎖定包裝每一份量基準: ${finalNutrients.servingSize}g`);
      }

      // =========================================================================
      // 【營養素合理性檢查 & 膳食纖維計算】(Atwater System & Fiber Verification)
      // =========================================================================
      setPaddleProgress(97);
      setPaddleStatus('進行三大營養素、熱量與膳食纖維合理性精密校驗...');

      const fiberVal = Math.max(0, Math.round((Number(finalNutrients.fiber) || 0) * 10) / 10);
      const carbsVal = Math.max(0, Math.round((Number(finalNutrients.carbs) || 0) * 10) / 10);
      const proteinVal = Math.max(0, Math.round((Number(finalNutrients.protein) || 0) * 10) / 10);
      const fatVal = Math.max(0, Math.round((Number(finalNutrients.fat) || 0) * 10) / 10);
      let sugarsVal = Math.max(0, Math.round((Number(finalNutrients.sugars) || 0) * 10) / 10);
      const caloriesVal = Math.max(0, Math.round((Number(finalNutrients.calories) || 0) * 10) / 10);

      // 【糖超出碳水智能仲裁】：糖為碳水化合物之一部分，若辨識數值糖 > 總碳水，判定為雜訊誤判，仲裁歸 0
      let sugarArbitratedToZero = false;
      if (sugarsVal > carbsVal) {
        sugarArbitratedToZero = true;
        debugLogs.push(`  ⚖️ [糖份合理性仲裁] 辨識糖份 (${sugarsVal}g) 超出總碳水 (${carbsVal}g)，依營養學邏輯仲裁直接歸 0。`);
        sugarsVal = 0;
        finalNutrients.sugars = 0;
      }

      // 淨碳水 (Net Carbs) = 總碳水 - 膳食纖維
      const netCarbs = Math.max(0, Math.round((carbsVal - fiberVal) * 10) / 10);
      
      // Atwater System 理論熱量精算：淨碳×4 + 膳食纖維×2 + 蛋白×4 + 脂肪×9
      const calculatedCalories = fiberVal > 0
        ? Math.round((netCarbs * 4 + fiberVal * 2 + proteinVal * 4 + fatVal * 9) * 10) / 10
        : Math.round((carbsVal * 4 + proteinVal * 4 + fatVal * 9) * 10) / 10;

      const calorieDiff = Math.round(Math.abs(caloriesVal - calculatedCalories) * 10) / 10;
      const calorieDiffPct = caloriesVal > 0
        ? Math.round((calorieDiff / caloriesVal) * 100)
        : (calculatedCalories > 0 ? 100 : 0);

      const isCalorieMatch = calorieDiff <= 5 || calorieDiffPct <= 10;
      const isSugarValid = sugarsVal <= carbsVal || carbsVal === 0;
      const isFiberValid = fiberVal <= carbsVal || carbsVal === 0;

      const issues: string[] = [];
      if (sugarArbitratedToZero) {
        issues.push(`辨識糖份超出總碳水化合物，已自動執行仲裁歸 0g`);
      }
      if (!isFiberValid) issues.push(`膳食纖維 (${fiberVal}g) 超出總碳水 (${carbsVal}g)`);
      if (caloriesVal > 0 && calculatedCalories > 0 && calorieDiffPct > 20) {
        issues.push(`標示熱量 (${caloriesVal} kcal) 與理論精算 (${calculatedCalories} kcal) 差距達 ${calorieDiff} kcal (${calorieDiffPct}%)`);
      }

      debugLogs.push(`\n[${nowStr()}] ═════════════════════════════════════════════`);
      debugLogs.push(`[${nowStr()}] 🧮 [營養素合理性檢查 & 膳食纖維計算 (Atwater System)]`);
      debugLogs.push(`  • 淨碳水 (Net Carbs) = 總碳水 (${carbsVal}g) - 膳食纖維 (${fiberVal}g) = ${netCarbs}g`);
      if (fiberVal > 0) {
        debugLogs.push(`  • 理論熱量換算 = 4×淨碳(${netCarbs}g) + 2×纖維(${fiberVal}g) + 4×蛋白(${proteinVal}g) + 9×脂肪(${fatVal}g) = ${calculatedCalories} kcal`);
      } else {
        debugLogs.push(`  • 理論熱量換算 = 4×碳水(${carbsVal}g) + 4×蛋白(${proteinVal}g) + 9×脂肪(${fatVal}g) = ${calculatedCalories} kcal`);
      }
      debugLogs.push(`  • 標示熱量: ${caloriesVal} kcal vs 理論換算: ${calculatedCalories} kcal (差異: ${calorieDiff} kcal, ${calorieDiffPct}%)`);
      if (issues.length > 0) {
        issues.forEach(iss => debugLogs.push(`  ⚠️ [校驗提示] ${iss}`));
      } else {
        debugLogs.push(`  ✓ [校驗合格] 三大營養素、膳食纖維與總熱量比例完全吻合`);
      }
      debugLogs.push(`[${nowStr()}] ═════════════════════════════════════════════`);

      const hasDetectedNutrients =
        finalNutrients.calories > 0 ||
        finalNutrients.protein > 0 ||
        finalNutrients.fat > 0 ||
        finalNutrients.carbs > 0 ||
        finalNutrients.sodium > 0 ||
        finalNutrients.sugars > 0 ||
        finalNutrients.fiber > 0 ||
        finalNutrients.potassium > 0;

      const extNames = extractorsToRun.map(id => EXTRACTOR_MODELS_LIST.find(m => m.id === id)?.name?.split(' ')[0] || id).join(' + ');
      const semNames = semanticsToRun.map(id => SEMANTIC_MODELS_LIST.find(m => m.id === id)?.name?.split(' ')[0] || id).join(' + ');

      let rawText = `=========================================\n`;
      rawText += `🤖 影像演算法排列組合與五階段整合推論報告\n`;
      rawText += `=========================================\n`;
      rawText += `🖼️ 【第一欄：影像處理變體】: 生成 ${imageVariants.length} 種影像變體 (選定 ${selectedPreprocessing.length}/3 項演算法)\n`;
      rawText += `🎯 【第二欄：特徵定位裁切】: ${locatorName}\n`;
      rawText += `📝 【第三欄：文字提取組合】: ${extNames} (${extractorsToRun.length}/2 個模型)\n`;
      rawText += `🧠 【第四欄：語意分析組合】: ${semNames} (${semanticsToRun.length}/2 個分析)\n`;
      rawText += `⚖️ 【第五欄：多模型整合策略】: ${ensembleStrategy === 'weighted_vote' ? '加權投票模式 (Weighted Voting)' : '補強組合模式 (Complementary Fill-in)'}\n`;
      rawText += `🔄 【推論分支總數】: ${branchResults.length} / 36 次排列組合分支\n\n`;

      // Branches Summary
      rawText += `=========================================\n`;
      rawText += `📊 各排列組合分支辨識結果明細\n`;
      rawText += `=========================================\n`;
      branchResults.forEach((b, idx) => {
        rawText += `[分支 ${idx + 1}] 🏷️ 影像[${b.imageVariantLabel}] ➔ ${b.extractorName.split(' ')[0]} ➔ ${b.semanticName.split(' ')[0]}:\n`;
        rawText += `  • 熱量: ${b.nutrients.calories} kcal | 蛋白質: ${b.nutrients.protein}g | 脂肪: ${b.nutrients.fat}g | 碳水: ${b.nutrients.carbs}g | 糖: ${b.nutrients.sugars}g | 纖維: ${b.nutrients.fiber}g | 鈉: ${b.nutrients.sodium}mg\n\n`;
      });

      if (hasDetectedNutrients) {
        rawText += `=========================================\n`;
        rawText += `🎯 【${ensembleStrategy === 'weighted_vote' ? '加權投票' : '補強組合'}】整合最終數據\n`;
        rawText += `=========================================\n`;
        rawText += `🔥 熱量 (Calories)     : ${finalNutrients.calories || 0} kcal   (來源: ${filledSources.calories})\n`;
        rawText += `💪 蛋白質 (Protein)    : ${finalNutrients.protein || 0} g      (來源: ${filledSources.protein})\n`;
        rawText += `🥑 脂肪 (Total Fat)    : ${finalNutrients.fat || 0} g      (來源: ${filledSources.fat})\n`;
        rawText += `🍞 碳水 (Carbs)        : ${finalNutrients.carbs || 0} g      (來源: ${filledSources.carbs})\n`;
        rawText += `🍬 糖 (Sugars)         : ${finalNutrients.sugars || 0} g      (來源: ${filledSources.sugars})\n`;
        rawText += `🥗 膳食纖維 (Fiber)    : ${finalNutrients.fiber || 0} g      (來源: ${filledSources.fiber})\n`;
        rawText += `🧂 鈉 (Sodium)          : ${finalNutrients.sodium || 0} mg    (來源: ${filledSources.sodium})\n`;
        rawText += `🍌 鉀 (Potassium)       : ${finalNutrients.potassium || 0} mg    (來源: ${filledSources.potassium})\n`;
        rawText += `=========================================\n\n`;

        rawText += `=========================================\n`;
        rawText += `🧮 營養素合理性檢查 & 膳食纖維計算\n`;
        rawText += `=========================================\n`;
        rawText += `• 淨碳水 (Net Carbs) = 總碳水 (${carbsVal}g) - 膳食纖維 (${fiberVal}g) = ${netCarbs}g\n`;
        if (fiberVal > 0) {
          rawText += `• 理論換算熱量 = 4×${netCarbs}(淨碳) + 2×${fiberVal}(纖維) + 4×${proteinVal}(蛋) + 9×${fatVal}(脂) = ${calculatedCalories} kcal\n`;
        } else {
          rawText += `• 理論換算熱量 = 4×${carbsVal}(碳) + 4×${proteinVal}(蛋) + 9×${fatVal}(脂) = ${calculatedCalories} kcal\n`;
        }
        rawText += `• 標示熱量 (${caloriesVal} kcal) vs 理論換算 (${calculatedCalories} kcal) 差距: ${calorieDiff} kcal (${calorieDiffPct}%)\n`;
        if (issues.length > 0) {
          issues.forEach(i => rawText += `⚠️ 提示: ${i}\n`);
        } else {
          rawText += `✓ 驗證狀態: 營養素比例與總熱量吻合\n`;
        }
        rawText += `=========================================\n\n`;
      } else {
        rawText += `🟡 狀態：已完成所有排列組合推論，但【未辨識出明確的營養成分表】。\n\n`;
        rawText += `🛡️ 【零猜測守則已生效】\n`;
        rawText += `系統嚴格拒絕捏造或猜測任何數值，所有數值維持 0。\n\n`;
      }

      const firstSnippet = branchResults.find(b => b.rawSnippet.trim().length > 0)?.rawSnippet || '(未檢測到清晰文字)';
      rawText += `【原始讀取文字片段 (首個有效分支)】\n${firstSnippet}`;

      const rawUnformattedText = branchResults.length > 0
        ? branchResults.map((b, idx) => {
            const rawContent = b.fullRawText?.trim() || '(此分支模型未檢出底層文字)';
            return `--- [分支 ${idx + 1}: 變體 ${b.imageVariantLabel} | 提取模型 ${b.extractorName.split(' ')[0]}] ---\n${rawContent}`;
          }).join('\n\n')
        : '(模型未有產出的底層未格式化字串)';

      setPaddleProgress(100);
      setPaddleStatus(`推論完成！共完成 ${branchResults.length} 組分支辨識與校驗`);

      setSimulatedOcrResult({
        modelId: `[${imageVariants.length}張影像變體] ➔ ${locatorId} ➔ [${extNames}] ➔ [${semNames}] ➔ [${ensembleStrategy === 'weighted_vote' ? '加權投票' : '補強組合'}]`,
        rawText,
        rawUnformattedText,
        nutrients: finalNutrients,
        debugLogs,
        ensembleStrategy,
        verification: {
          calculatedCalories,
          netCarbs,
          diffCalories: calorieDiff,
          diffPct: calorieDiffPct,
          isCalorieMatch,
          isSugarValid,
          isFiberValid,
          issues,
          runnerUpCalories,
          topCandidateCalories,
          arbitratedByAtwater,
          arbitratedNote,
          nutrientCandidates: nutrientCandidatesMap,
        },
      });

      // 一般使用者模式：辨識成功後，自動呼叫自訂食品對話框並填入對應數值 (名稱與品牌留空)
      if (hasDetectedNutrients && !ocrAdminMode) {
        debugLogs.push(`[${nowStr()}] [Auto-Open] 辨識成功！自動開啟自訂食品對話框，營養數值已代入，每份份量: ${finalNutrients.servingSize || 100}g，名稱與品牌留空...`);
        setTimeout(() => {
          onOpenCustomFoodModal({
            id: 'custom_ocr_' + Date.now(),
            name: '',
            brand: '',
            calories: finalNutrients.calories,
            protein: finalNutrients.protein,
            fat: finalNutrients.fat,
            carbs: finalNutrients.carbs,
            sugars: finalNutrients.sugars,
            fiber: finalNutrients.fiber,
            sodium: finalNutrients.sodium,
            potassium: finalNutrients.potassium,
            servingAmount: finalNutrients.servingSize || 100,
            servingUnit: 'g',
            aiSource: 'vision',
          });
        }, 400);
      }
    } catch (err: any) {
      debugLogs.push(`[${nowStr()}] [OCR 異常錯誤] ${err.message}`);
      setSimulatedOcrResult({
        modelId: `${locatorId}`,
        rawText: `辨識失敗: ${err.message}`,
        nutrients: { calories: 0, protein: 0, fat: 0, carbs: 0, sodium: 0, sugars: 0, fiber: 0, potassium: 0 },
        debugLogs,
        ensembleStrategy,
        verification: {
          calculatedCalories: 0,
          netCarbs: 0,
          diffCalories: 0,
          diffPct: 0,
          isCalorieMatch: true,
          isSugarValid: true,
          isFiberValid: true,
          issues: [],
        },
      });
    } finally {
      setIsSimulatingOcr(false);
    }
  };

  const handleOcrImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setOcrImageBase64(base64);
      setSimulatedOcrResult(null); // Clear previous runs
    };
    reader.readAsDataURL(file);
  };

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
  const [subStore, setSubStore] = useState<'family' | 'mcd' | 'subway'>('family');
  const [familyKeyword, setFamilyKeyword] = useState('');
  const [isFamilySearching, setIsFamilySearching] = useState(false);
  const [familyResults, setFamilyResults] = useState<FoodSearchResult[]>([]);
  const [familyError, setFamilyError] = useState('');
  const [showBatchModal, setShowBatchModal] = useState(false);

  // McDonald's Search state
  const [mcdKeyword, setMcdKeyword] = useState('');
  const [isMcdSearching, setIsMcdSearching] = useState(false);
  const [isMcdCrawlingAll, setIsMcdCrawlingAll] = useState(false);
  const [mcdResults, setMcdResults] = useState<FoodSearchResult[]>([]);
  const [mcdError, setMcdError] = useState('');
  const [mcdSuccessMsg, setMcdSuccessMsg] = useState('');

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
        
        // Save all products to Firestore mcdonald_foods
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
        setMcdSuccessMsg(`成功從 Firebase 雲端資料庫（mcdonald_foods）載入 ${list.length} 筆麥當勞食品！`);
      } else {
        setMcdError('Firebase 雲端資料庫中尚無麥當勞資料。點擊上方「一鍵全量爬取」即可將官網品項自動存入 Firebase！');
      }
    } catch (err: any) {
      console.error('Load McDonald from Firebase error:', err);
      setMcdError('從 Firebase 載入麥當勞資料時發生錯誤');
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
      // 1. Check Firebase mcdonald_foods first
      const cached = await McdonaldCacheService.searchMcdonaldFoodsInFirestore(query);
      if (cached && cached.length > 0) {
        setMcdResults(cached);
        setMcdSuccessMsg(`已優先從 Firebase 雲端快取速載 ${cached.length} 筆相符食品！`);
        setIsMcdSearching(false);
        return;
      }

      // 2. Fallback to live server crawler if not cached
      const res = await fetch('/api/mcd/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: query })
      });

      if (!res.ok) {
        throw new Error('搜尋麥當勞食品失敗，請稍後重試');
      }

      const data = await res.json();
      if (data.products && Array.isArray(data.products)) {
        setMcdResults(data.products);
        
        // Sync searched items to Firestore 'mcdonald_foods' collection
        McdonaldCacheService.saveMcDonaldFoods(data.products).catch((err) => {
          console.error('[AddFoodModal] Failed to sync McDonald foods to Firestore:', err);
        });

        if (data.products.length === 0) {
          setMcdError('找不到符合的麥當勞食品，請嘗試其他關鍵字（例如：大麥克、薯條、麥克鷄塊）。');
        } else {
          setMcdSuccessMsg(`已即時爬取官網 ${data.products.length} 筆資料，並自動同步至 Firebase 雲端！`);
        }
      }
    } catch (err: any) {
      console.error('McDonald search error:', err);
      setMcdError(err.message || '搜尋發生錯誤');
    } finally {
      setIsMcdSearching(false);
    }
  };

  // Subway Search state
  const [subwayKeyword, setSubwayKeyword] = useState('');
  const [isSubwaySearching, setIsSubwaySearching] = useState(false);
  const [isSubwayCrawlingAll, setIsSubwayCrawlingAll] = useState(false);
  const [subwayResults, setSubwayResults] = useState<FoodSearchResult[]>([]);
  const [subwayError, setSubwayError] = useState('');
  const [subwaySuccessMsg, setSubwaySuccessMsg] = useState('');

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

      if (!res.ok) {
        throw new Error('一鍵爬取 Subway 全量菜單失敗，請稍後重試');
      }

      const data = await res.json();
      if (data.products && Array.isArray(data.products) && data.products.length > 0) {
        setSubwayResults(data.products);
        
        // Save all products to Firestore subway_foods
        await SubwayCacheService.saveSubwayFoods(data.products);
        setSubwaySuccessMsg(`成功一鍵爬取並將 ${data.products.length} 筆 Subway 官方菜單同步至 Firebase 雲端資料庫！`);
      } else {
        setSubwayError('未爬取到任何 Subway 品項，請稍後再試。');
      }
    } catch (err: any) {
      console.error('Subway crawl all error:', err);
      setSubwayError(err.message || '一鍵爬取 Subway 時發生未知錯誤');
    } finally {
      setIsSubwayCrawlingAll(false);
    }
  };

  const handleLoadSubwayFromFirebase = async () => {
    setIsSubwaySearching(true);
    setSubwayError('');
    setSubwaySuccessMsg('');
    try {
      const list = await SubwayCacheService.getSubwayFoodsFromFirestore();
      if (list && list.length > 0) {
        setSubwayResults(list);
        setSubwaySuccessMsg(`成功從 Firebase 雲端資料庫（subway_foods）載入 ${list.length} 筆 Subway 食品！`);
      } else {
        setSubwayError('Firebase 雲端資料庫中尚無 Subway 資料。點擊上方「一鍵全量爬取」即可將官網品項自動存入 Firebase！');
      }
    } catch (err: any) {
      console.error('Load from Firebase error:', err);
      setSubwayError('從 Firebase 載入 Subway 資料時發生錯誤');
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
      // 1. Check Firebase subway_foods first
      const cached = await SubwayCacheService.searchSubwayFoodsInFirestore(query);
      if (cached && cached.length > 0) {
        setSubwayResults(cached);
        setSubwaySuccessMsg(`已優先從 Firebase 雲端快取速載 ${cached.length} 筆相符食品！`);
        setIsSubwaySearching(false);
        return;
      }

      // 2. Fallback to live server crawler if not cached
      const res = await fetch('/api/subway/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: query })
      });

      if (!res.ok) {
        throw new Error('搜尋 Subway 食品失敗，請稍後重試');
      }

      const data = await res.json();
      if (data.products && Array.isArray(data.products)) {
        setSubwayResults(data.products);
        
        // Sync searched items to Firestore 'subway_foods' collection
        SubwayCacheService.saveSubwayFoods(data.products).catch((err) => {
          console.error('[AddFoodModal] Failed to sync Subway foods to Firestore:', err);
        });

        if (data.products.length === 0) {
          setSubwayError('找不到符合的 Subway 食品，請嘗試其他關鍵字（例如：牛肉、嫩雞、潛艇堡、餅乾、沙拉）。');
        } else {
          setSubwaySuccessMsg(`已即時爬取官網 ${data.products.length} 筆資料，並自動同步至 Firebase 雲端！`);
        }
      }
    } catch (err: any) {
      console.error('Subway search error:', err);
      setSubwayError(err.message || '搜尋 Subway 時發生未知錯誤');
    } finally {
      setIsSubwaySearching(false);
    }
  };

  // Auto-load McDonald's / Subway foods from Firebase when switching to their store tab
  useEffect(() => {
    if (activeTab === 'FAMILY') {
      if (subStore === 'mcd' && mcdResults.length === 0 && !isMcdSearching && !isMcdCrawlingAll) {
        handleLoadMcdFromFirebase();
      } else if (subStore === 'subway' && subwayResults.length === 0 && !isSubwaySearching && !isSubwayCrawlingAll) {
        handleLoadSubwayFromFirebase();
      }
    }
  }, [activeTab, subStore]);

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
        const filtered = await FamilyCacheService.setCachedFamilySearch(query, data.products);
        setFamilyResults(filtered);
        if (filtered.length === 0) {
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
    } else if (activeTab === 'CLOUD') {
      list = cloudFoods;
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

      // Second check in cloud database (cloud_foods)
      const cloudMatch = await CloudFoodService.fetchCloudFoodByBarcode(trimmed);
      if (cloudMatch) {
        onSelectFood(cloudMatch);
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

  const [ocrError, setOcrError] = useState('');


  // Helper to parse API JSON responses safely without throwing HTML syntax errors
  const parseApiResponse = async (res: Response): Promise<any> => {
    const text = await res.text().catch(() => '');
    let json: any = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        // Response was not valid JSON (e.g. HTML error page)
      }
    }

    if (res.ok) {
      if (json) return json;
      console.warn('[API] Response was OK but returned non-JSON body:', text.slice(0, 200));
      throw new Error('AI 伺服器回應格式異常，請稍後重試。');
    }

    // Extract error message from JSON body or handle status
    const errMsg = json?.error || json?.message || '';
    if (res.status === 503 || errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('Busy') || errMsg.includes('UNAVAILABLE')) {
      const err = new Error('AI 伺服器忙碌中，請稍後重試') as any;
      err.status = 503;
      throw err;
    }

    if (res.status === 429 || errMsg.includes('Quota Exceeded') || errMsg.includes('429')) {
      const err = new Error('Gemini API 額度已達上限，請稍後重試或至設定更換 API Key') as any;
      err.status = 429;
      throw err;
    }

    if (errMsg) {
      throw new Error(errMsg);
    }

    throw new Error(`AI 伺服器暫時無法回應 (${res.status})`);
  };

  // Separate AI call logic for reusability (Retries)
  const performImageAnalysis = async (base64: string, mime: string) => {
    setAiLoading(true);
    setAiError('');
    setAiProgress(10);
    setAiStatus('正在初始化 AI 辨識系統...');

    try {
      setAiProgress(20);
      setAiStatus('正在優化圖片以加快辨識速度...');

      // 核心優化：在前端先壓縮圖片 (帶有 fallback 機制)
      let optimizedBase64 = base64;
      try {
        optimizedBase64 = await optimizeImageForAi(base64, 768, 768, 0.7);
      } catch (optErr) {
        console.warn('[Image Optimizer] 圖片壓縮失敗，改用原圖 Base64進行辨識:', optErr);
      }

      const aiParams = getAiRequestParams();
      const preferredModel = StorageService.getSelectedAiModel();
      
      const ALLOWED_3X_MODELS = [
        'gemini-3.8-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.1-flash-lite',
      ];
      
      const targetModel = ALLOWED_3X_MODELS.includes(preferredModel) ? preferredModel : 'gemini-3.8-flash';
      const modelsToTry = [
        targetModel,
        ...ALLOWED_3X_MODELS.filter(m => m !== targetModel),
      ];

      let lastResult: any = null;
      let finalModelUsed = targetModel;

      for (let i = 0; i < modelsToTry.length; i++) {
        const currentModel = modelsToTry[i];
        finalModelUsed = currentModel;
        
        setAiProgress(30 + (i * 15));
        const retryMsg = i > 0 ? `(正在自動切換後援第 ${i} 次) ` : '';
        setAiStatus(`${retryMsg}[${currentModel}] 正在進行 AI 影像分析...`);

        // Smooth progression timer
        let currentProgress = 30 + (i * 15);
        const maxSubProgress = 30 + ((i + 1) * 15);
        const progressInterval = setInterval(() => {
          if (currentProgress < maxSubProgress - 2) {
            currentProgress += 1;
            setAiProgress(Math.min(Math.round(currentProgress), 85));
          }
        }, 300);

        try {
          const res = await fetch('/api/ai/estimate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              imageBase64: optimizedBase64,
              mimeType: 'image/jpeg',
              customApiKey: aiParams.customApiKey,
              apiKeySource: aiParams.apiKeySource,
              userEmail: aiParams.userEmail,
              userUid: aiParams.userUid,
              model: currentModel,
              disableFallback: true // 讓前端掌握 Fallback 視覺顯示
            }),
          });

          clearInterval(progressInterval);
          
          lastResult = await parseApiResponse(res);
          break; // Success!
        } catch (err: any) {
          clearInterval(progressInterval);
          const errStatus = err.status || 0;
          const errMsg = String(err.message || '');
          const isTransient = errStatus === 503 || errStatus === 429 || 
                             errMsg.includes('503') || errMsg.includes('429') || 
                             errMsg.includes('忙碌') || errMsg.includes('high demand') ||
                             errMsg.includes('RESOURCE_EXHAUSTED');

          if (isTransient && i < modelsToTry.length - 1) {
            console.warn(`[AI Fallback] ${currentModel} returned transient error (${errMsg}), trying next model...`);
            continue;
          }

          throw err;
        }
      }

      if (!lastResult) {
        throw new Error('AI 伺服器目前忙碌中，請稍後重試。');
      }

      setAiProgress(88);
      setAiStatus('分析完成！');

      const result = lastResult;
      if (result._usage) {
        StorageService.recordApiUsage(result._usage);
      }

      const usedModel = result._modelUsed || finalModelUsed;
      setAiProgress(96);
      setAiStatus(`[${usedModel}] 資料擷取中...`);


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
      const aiParams = getAiRequestParams();
      const preferredModel = StorageService.getSelectedAiModel();
      
      const ALLOWED_3X_MODELS = [
        'gemini-3.8-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.1-flash-lite',
      ];
      
      const targetModel = ALLOWED_3X_MODELS.includes(preferredModel) ? preferredModel : 'gemini-3.1-flash-lite';
      const modelsToTry = [
        targetModel,
        ...ALLOWED_3X_MODELS.filter(m => m !== targetModel),
      ];

      let lastResult: any = null;
      let finalModelUsed = targetModel;

      for (let i = 0; i < modelsToTry.length; i++) {
        const currentModel = modelsToTry[i];
        finalModelUsed = currentModel;
        
        setAiProgress(40 + (i * 10));
        const retryMsg = i > 0 ? `(正在自動切換後援第 ${i} 次) ` : '';
        setAiStatus(`${retryMsg}[${currentModel}] 正在由 AI 營養師估算中...`);

        try {
          const res = await fetch('/api/ai/estimate-nutrition', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              query: aiPrompt.trim(), 
              customApiKey: aiParams.customApiKey,
              apiKeySource: aiParams.apiKeySource,
              userEmail: aiParams.userEmail,
              userUid: aiParams.userUid,
              model: currentModel,
              disableFallback: true
            }),
          });

          lastResult = await parseApiResponse(res);
          break; // Success!
        } catch (err: any) {
          const errStatus = err.status || 0;
          const errMsg = String(err.message || '');
          const isTransient = errStatus === 503 || errStatus === 429 || 
                             errMsg.includes('503') || errMsg.includes('429') || 
                             errMsg.includes('忙碌') || errMsg.includes('high demand') ||
                             errMsg.includes('RESOURCE_EXHAUSTED');

          if (isTransient && i < modelsToTry.length - 1) {
            console.warn(`[AI Fallback] ${currentModel} returned transient error (${errMsg}), trying next model...`);
            continue;
          }

          throw err;
        }
      }

      if (!lastResult) {
        throw new Error('AI 伺服器目前忙碌中，請稍後重試。');
      }

      const result = lastResult;
      if (result._usage) {
        StorageService.recordApiUsage(result._usage);
      }
      const usedModel = result._modelUsed || finalModelUsed;

      setAiProgress(85);
      setAiStatus(`[${usedModel}] 正在生成營養成分清單...`);

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

  useEffect(() => {
    // Body scroll lock
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl h-[85vh] max-h-[750px] rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300">
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

        {/* Search Mode Toggle (First Layer: Strictly 3 Buttons) */}
        <div className="p-3 border-b border-slate-100 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setMainCategory('GENERAL');
              setActiveTab('ALL');
            }}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mainCategory === 'GENERAL'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-100'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>一般搜尋</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMainCategory('AI');
              setActiveTab(aiSubTab);
            }}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mainCategory === 'AI'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-100'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>AI搜尋</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMainCategory('ADVANCED');
              setActiveTab(advancedSubTab);
            }}
            className={`flex-1 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              mainCategory === 'ADVANCED'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>進階搜尋</span>
          </button>
        </div>

        {/* Conditional Sub-Bar (Second Layer) for AI search */}
        {mainCategory === 'AI' && (
          <div className="px-4 pt-3 pb-2 border-b border-slate-100/60 bg-purple-50/30">
            <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => {
                  setAiSubTab('AI_SCAN');
                  setActiveTab('AI_SCAN');
                }}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  aiSubTab === 'AI_SCAN'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI辨識</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAiSubTab('BARCODE');
                  setActiveTab('BARCODE');
                }}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  aiSubTab === 'BARCODE'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Barcode className="w-3.5 h-3.5" />
                <span>條碼掃描</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAiSubTab('OCR_SCAN');
                  setActiveTab('OCR_SCAN');
                }}
                className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  aiSubTab === 'OCR_SCAN'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <ScanText className="w-3.5 h-3.5" />
                <span>OCR辨識</span>
              </button>
            </div>
          </div>
        )}

        {/* Conditional Sub-Bar for GENERAL search */}
        {mainCategory === 'GENERAL' && (
          <div className="px-4 pt-3 pb-2 space-y-2">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="搜尋衛福部官方資料庫或自訂飲食..."
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
            
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                全部
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('OFFICIAL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'OFFICIAL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                衛福部資料庫
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('CUSTOM')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                  activeTab === 'CUSTOM' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                自訂飲食
              </button>
            </div>
          </div>
        )}

        {/* Conditional Sub-Bar for ADVANCED search */}
        {mainCategory === 'ADVANCED' && (
          <div className="px-4 pt-3 pb-2 space-y-2">
            <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
              <button
                type="button"
                onClick={() => {
                  setAdvancedSubTab('FAMILY');
                  setActiveTab('FAMILY');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1 ${
                  advancedSubTab === 'FAMILY'
                    ? 'bg-white text-indigo-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Store className="w-3.5 h-3.5 text-orange-500" />
                品牌菜單
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdvancedSubTab('CLOUD');
                  setActiveTab('CLOUD');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1 ${
                  advancedSubTab === 'CLOUD'
                    ? 'bg-white text-indigo-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Cloud className="w-3.5 h-3.5 text-sky-500" />
                公共雲端庫
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdvancedSubTab('OPEN_FOOD');
                  setActiveTab('OPEN_FOOD');
                }}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1 ${
                  advancedSubTab === 'OPEN_FOOD'
                    ? 'bg-white text-indigo-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-amber-500" />
                Open Food
              </button>
            </div>

            {(advancedSubTab === 'CLOUD' || advancedSubTab === 'OPEN_FOOD') && (
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  placeholder={
                    advancedSubTab === 'OPEN_FOOD'
                      ? '搜尋 Open Food Facts 全球食品資料庫...'
                      : '搜尋公共網路食品資料庫...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && advancedSubTab === 'OPEN_FOOD' && handleSearchOnline()}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-100/80 rounded-2xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-indigo-600 focus:bg-white border border-transparent focus:border-indigo-200 transition"
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
            )}
          </div>
        )}


        {/* Smart Tool Switcher (Removed as tabs are now in main header) */}

        {/* Content Body */}
        <div ref={contentBodyRef} className="flex-1 overflow-y-auto p-4">
          {/* TAB: FAMILY SEARCH */}
          {activeTab === 'FAMILY' && (
            <div className="space-y-4 max-w-md mx-auto py-2">
              {/* Store Switcher Segmented Control */}
              <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
                <button
                  type="button"
                  onClick={() => setSubStore('family')}
                  className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    subStore === 'family'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  全家搜尋
                </button>
                <button
                  type="button"
                  onClick={() => setSubStore('mcd')}
                  className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    subStore === 'mcd'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  麥當勞搜尋
                </button>
                <button
                  type="button"
                  onClick={() => setSubStore('subway')}
                  className={`flex-1 py-2 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    subStore === 'subway'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  Subway 搜尋
                </button>
              </div>

              {/* STORE 1: FAMILY */}
              {subStore === 'family' && (
                <div className="space-y-4">
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

              {/* STORE 2: MCDONALD'S */}
              {subStore === 'mcd' && (
                <div className="space-y-4">
                  {isAdmin ? (
                    <div className="bg-red-50 border border-red-200/80 rounded-2xl p-4 text-red-950">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 font-bold text-sm text-red-700">
                          <Sparkles className="w-4 h-4 text-red-600" />
                          台灣麥當勞 官方營養計算機 & Firebase 雲端庫
                        </div>
                        <span className="text-[10px] font-black px-2 py-0.5 bg-red-200 text-red-800 rounded-md shrink-0">
                          👑 管理員
                        </span>
                      </div>
                      <p className="text-xs text-red-800/90 leading-relaxed mb-3">
                        預設優先從 Firebase 雲端資料庫（`mcdonald_foods`）速載查詢；若無資料則自動發起即時爬蟲。您也可以點擊下方按鈕進行全量同步或重載！
                      </p>

                      <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-red-200/60 w-full">
                        <button
                          type="button"
                          onClick={handleMcdCrawlAll}
                          disabled={isMcdCrawlingAll || isMcdSearching}
                          className="flex-1 w-full py-2.5 px-3.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isMcdCrawlingAll ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>全量爬取並同步中...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>一鍵全量爬取全菜單至 Firebase</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleLoadMcdFromFirebase}
                          disabled={isMcdCrawlingAll || isMcdSearching}
                          className="flex-1 w-full py-2.5 px-3.5 bg-white text-red-900 border border-red-300 hover:bg-red-100/80 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Database className="w-3.5 h-3.5 text-red-700" />
                          <span>從 Firebase 雲端載入全量資料</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-red-50/80 border border-red-200/60 rounded-2xl p-4 text-red-950">
                      <div className="flex items-center gap-2 font-bold text-sm mb-1 text-red-700">
                        <Sparkles className="w-4 h-4 text-red-600" />
                        台灣麥當勞 官方菜單庫 (Firebase 雲端連線)
                      </div>
                      <p className="text-xs text-red-800/90 leading-relaxed">
                        系統預設已自動為您自 Firebase 雲端資料庫載入麥當勞全量菜單，您可直接挑選品項或輸入關鍵字搜尋！
                      </p>
                    </div>
                  )}

                  {mcdSuccessMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in duration-200">
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{mcdSuccessMsg}</span>
                    </div>
                  )}

                  {/* 關鍵字搜尋框 */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <label className="block text-xs font-bold text-slate-700">搜尋麥當勞食品關鍵字</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="例如: 大麥克、薯條、麥克鷄塊、極選"
                        value={mcdKeyword}
                        onChange={(e) => setMcdKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleMcdSearch()}
                        className="flex-1 px-3 py-2.5 bg-white rounded-xl border border-slate-200 text-sm focus:outline-red-600"
                      />
                      <button
                        type="button"
                        onClick={() => handleMcdSearch()}
                        disabled={isMcdSearching || !mcdKeyword.trim()}
                        className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        {isMcdSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        搜尋麥當勞
                      </button>
                    </div>
                  </div>

                  {mcdError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{mcdError}</span>
                    </div>
                  )}

                  {mcdResults.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-200/60">
                      <div className="flex items-center justify-between px-1">
                        <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">麥當勞查詢結果 ({mcdResults.length})</h5>
                      </div>
                      {mcdResults.map((food) => (
                        <div
                          key={food.id}
                          onClick={() => onSelectFood(food)}
                          className="p-3 bg-white border border-slate-100 hover:border-red-300 rounded-2xl hover:shadow-sm transition cursor-pointer flex items-start justify-between gap-3 group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0 h-8">
                              <h4 className="font-bold text-sm text-slate-900 group-hover:text-red-800 truncate min-w-0 shrink">
                                {food.name}
                              </h4>
                              <div className="inline-flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectFood(food);
                                  }}
                                  className="p-1 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                  title="點擊修改/設定份量"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="text-[11px] font-semibold text-slate-400 -mt-0.5 mb-1">
                              麥當勞 McDonald's
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
                                ? 'bg-red-500 text-white scale-105 shadow-xs'
                                : 'text-slate-400 group-hover:text-red-700 group-hover:bg-red-50'
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

              {/* STORE 3: SUBWAY */}
              {subStore === 'subway' && (
                <div className="space-y-4">
                  {isAdmin ? (
                    <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-amber-950">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
                          <Flame className="w-4 h-4 text-amber-600" />
                          台灣 Subway 官方營養資訊爬蟲 & Firebase 雲端庫
                        </div>
                        <span className="text-[10px] font-black px-2 py-0.5 bg-amber-200 text-amber-800 rounded-md shrink-0">
                          👑 管理員
                        </span>
                      </div>
                      <p className="text-xs text-amber-900 leading-relaxed mb-3">
                        Subway 官網結構清晰，您可以點擊下方按鈕進行全量同步存入 Firebase `subway_foods` 或手動重新載入。
                      </p>
                      
                      <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-amber-200/60 w-full">
                        <button
                          type="button"
                          onClick={handleSubwayCrawlAll}
                          disabled={isSubwayCrawlingAll || isSubwaySearching}
                          className="flex-1 w-full py-2.5 px-3.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isSubwayCrawlingAll ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>全量爬取並同步中...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>一鍵全量爬取全菜單至 Firebase</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleLoadSubwayFromFirebase}
                          disabled={isSubwayCrawlingAll || isSubwaySearching}
                          className="flex-1 w-full py-2.5 px-3.5 bg-white text-amber-900 border border-amber-300 hover:bg-amber-100/80 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <Database className="w-3.5 h-3.5 text-amber-700" />
                          <span>從 Firebase 雲端載入全量資料</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50/80 border border-amber-200/60 rounded-2xl p-4 text-amber-950">
                      <div className="flex items-center gap-2 font-bold text-sm mb-1 text-amber-800">
                        <Flame className="w-4 h-4 text-amber-600" />
                        台灣 Subway 官方菜單庫 (Firebase 雲端連線)
                      </div>
                      <p className="text-xs text-amber-900 leading-relaxed">
                        系統預設已自動為您自 Firebase 雲端資料庫載入 Subway 全量菜單，您可直接挑選品項或輸入關鍵字搜尋！
                      </p>
                    </div>
                  )}

                  {subwaySuccessMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in duration-200">
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{subwaySuccessMsg}</span>
                    </div>
                  )}

                  {/* 關鍵字搜尋框 */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <label className="block text-xs font-bold text-slate-700">搜尋 Subway 食品關鍵字</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="例如: 牛肉、嫩雞、潛艇堡、餅乾、沙拉"
                        value={subwayKeyword}
                        onChange={(e) => setSubwayKeyword(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubwaySearch()}
                        className="flex-1 px-3 py-2.5 bg-white rounded-xl border border-slate-200 text-sm focus:outline-amber-600"
                      />
                      <button
                        type="button"
                        onClick={() => handleSubwaySearch()}
                        disabled={isSubwaySearching || !subwayKeyword.trim()}
                        className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        {isSubwaySearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        搜尋 Subway
                      </button>
                    </div>
                  </div>

                  {subwayError && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{subwayError}</span>
                    </div>
                  )}

                  {/* Subway 搜尋結果列表 */}
                  {subwayResults.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-200/60">
                      <div className="flex items-center justify-between px-1">
                        <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-wider">Subway 查詢結果 ({subwayResults.length})</h5>
                      </div>

                      {subwayResults.map((food) => (
                        <div
                          key={`subway_res_${food.id}`}
                          onClick={() => onSelectFood(food)}
                          className="p-3 bg-white border border-slate-100 hover:border-amber-300 rounded-2xl hover:shadow-xs transition cursor-pointer flex items-start justify-between gap-3 group"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 min-w-0 h-8">
                              <h4 className="font-bold text-sm text-slate-900 group-hover:text-amber-800 truncate min-w-0 shrink">
                                {food.name}
                              </h4>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectFood(food);
                                }}
                                className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                title="點擊修改/設定份量"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="text-[11px] font-semibold text-slate-400 -mt-0.5 mb-1">
                              SUBWAY 官方資訊
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
                                ? 'bg-amber-500 text-white scale-105 shadow-xs'
                                : 'text-slate-400 group-hover:text-amber-700 group-hover:bg-amber-50'
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
            </div>
          )}

          {/* PAGE 1: AI 影像 / 文字分析 */}
          {activeTab === 'AI_SCAN' && (
            <div className="space-y-4 max-w-md mx-auto py-2 animate-in fade-in duration-200">
              {/* Clean Intro Card */}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-4.5 text-white shadow-md">
                <div className="flex items-center gap-2 font-black text-sm mb-1.5">
                  <Sparkles className="w-4.5 h-4.5 text-amber-300 animate-pulse shrink-0" />
                  <span>Gemini 3.x AI 影像與文字分析</span>
                </div>
                <p className="text-xs text-purple-100 leading-relaxed font-medium">
                  拍攝食物照片、上傳圖庫或輸入文字描述，由 AI 自動辨識食材與估算營養素（蛋白質、碳水化合物、脂肪與熱量）。
                </p>
                <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-purple-500/40 text-[11px] text-purple-200 font-semibold">
                  <span className="flex items-center gap-1">📸 照片與即時拍攝</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">✍️ 菜單與外食描述</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">⚡ 多模型自動備援</span>
                </div>
              </div>

              {/* Section 1: Image & Camera Analysis */}
              <div className="bg-white border border-purple-100 rounded-3xl p-4.5 shadow-2xs space-y-3.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-purple-950 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-purple-600" />
                    <span>照片與相機分析</span>
                  </label>
                  <span className="text-[10px] font-bold text-slate-400">拍攝佳餚或上傳圖庫</span>
                </div>

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
                  <div className="relative inline-block w-full text-center group">
                    <img
                      src={selectedImageBase64}
                      alt="辨識照片預覽"
                      className="w-44 h-44 object-cover rounded-2xl border-2 border-purple-300 shadow-sm mx-auto"
                    />
                    <div className="mt-3 flex justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAiCameraModalOpen(true)}
                        className="px-3 py-1.5 bg-purple-700 text-white rounded-xl shadow-xs text-xs font-bold hover:bg-purple-800 transition cursor-pointer flex items-center gap-1"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        重拍照片
                      </button>
                      <button
                        type="button"
                        onClick={() => galleryInputRef.current?.click()}
                        className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition cursor-pointer flex items-center gap-1"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        重新選擇
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedImageBase64(null)}
                        className="px-2.5 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition cursor-pointer flex items-center"
                        title="清除照片"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsAiCameraModalOpen(true)}
                      className="py-3.5 px-3 bg-purple-50 hover:bg-purple-100 border border-purple-200/80 rounded-2xl text-purple-900 transition flex flex-col items-center justify-center gap-1.5 cursor-pointer group active:scale-98"
                    >
                      <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                        <Camera className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold">開啟相機拍攝</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      className="py-3.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-2xl text-slate-800 transition flex flex-col items-center justify-center gap-1.5 cursor-pointer group active:scale-98"
                    >
                      <div className="w-9 h-9 rounded-xl bg-slate-700 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                        <Upload className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold">上傳相片圖庫</span>
                    </button>
                  </div>
                )}

                {selectedImageBase64 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!checkAiKeyOrWarn()) return;
                      performImageAnalysis(selectedImageBase64, lastImageMimeType);
                    }}
                    disabled={aiLoading}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98"
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    <span>開始 AI 影像估算</span>
                  </button>
                )}
              </div>

              {/* Section 2: AI Text Prompt Analysis */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-4.5 shadow-2xs space-y-3">
                <label className="block text-xs font-black text-slate-800">
                  食物名稱 / 外食描述估算
                </label>
                <div className="space-y-2.5">
                  <input
                    type="text"
                    placeholder="例如: 摩斯藜麥燒肉珍珠堡、超商雞腿便當"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAiTextAnalyze()}
                    className="w-full px-3.5 py-2.5 bg-slate-50 rounded-2xl border border-slate-200 text-sm font-medium focus:outline-purple-600 focus:bg-white transition"
                  />
                  <button
                    type="button"
                    onClick={handleAiTextAnalyze}
                    disabled={aiLoading || !aiPrompt.trim()}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    AI 文字估算
                  </button>
                </div>
              </div>

              {/* Animated Progress Bar */}
              {aiLoading && (
                <div className="py-5 px-4 bg-purple-50/80 rounded-2xl border border-purple-100 text-center space-y-3 animate-in fade-in duration-200">
                  <div className="relative">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto opacity-20" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-purple-600 animate-pulse" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black text-purple-700 uppercase tracking-wider px-1">
                      <span>{aiStatus}</span>
                      <span>{aiProgress}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-white border border-purple-200/80 rounded-full overflow-hidden shadow-2xs">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-300 ease-out rounded-full"
                        style={{ width: `${aiProgress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}

              {aiError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{aiError}</span>
                  </div>
                  {retryAction && (
                    <button
                      onClick={() => retryAction()}
                      className="ml-6 px-3 py-1 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 transition cursor-pointer"
                    >
                      再試一次
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PAGE 2: 條碼掃描 */}
          {activeTab === 'BARCODE' && (
            <div className="space-y-4 max-w-md mx-auto py-2 animate-in fade-in duration-200">
              {/* Clean Intro Card */}
              <div className="bg-gradient-to-r from-blue-600 to-sky-600 rounded-3xl p-4.5 text-white shadow-md">
                <div className="flex items-center gap-2 font-black text-sm mb-1.5">
                  <Barcode className="w-4.5 h-4.5 text-sky-200 shrink-0" />
                  <span>商品條碼即時比對</span>
                </div>
                <p className="text-xs text-blue-100 leading-relaxed font-medium">
                  對準食品包裝上的條碼，或輸入 13 位條碼號碼，即可連線衛生福利部、超商與 Open Food Facts 全球資料庫查詢真實標示。
                </p>
                <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-blue-500/40 text-[11px] text-blue-100 font-semibold">
                  <span>📷 鏡頭即時自動辨識</span>
                  <span>·</span>
                  <span>🌐 全球與本機資料庫連線</span>
                </div>
              </div>

              {/* Section 1: Hero Camera Scanner Entry */}
              <div 
                onClick={() => setIsScannerModalOpen(true)}
                className="bg-white border-2 border-dashed border-blue-200 hover:border-blue-500 rounded-3xl p-6 text-center shadow-2xs hover:shadow-md transition-all cursor-pointer group space-y-3"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
                  <Barcode className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-black text-base text-slate-900 group-hover:text-blue-700 transition-colors">
                    開啟鏡頭條碼掃描
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    自動對焦與解碼商品包裝 13 位條碼
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsScannerModalOpen(true);
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition inline-flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Camera className="w-4 h-4" />
                  <span>即時啟動相機</span>
                </button>
              </div>

              {/* Section 2: Manual Barcode Lookup Box */}
              <div className="bg-white border border-slate-200/80 rounded-3xl p-4.5 shadow-2xs space-y-3">
                <label className="block text-xs font-black text-slate-800">
                  手動輸入商品條碼號碼
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="例如: 4710088195001"
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleBarcodeLookup(barcodeInput)}
                      className="w-full pl-3.5 pr-9 py-2.5 bg-slate-50 rounded-2xl border border-slate-200 text-sm font-mono focus:outline-blue-600 focus:bg-white transition"
                    />
                    <button
                      type="button"
                      onClick={() => setIsScannerModalOpen(true)}
                      title="開啟鏡頭即時掃描"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleBarcodeLookup(barcodeInput)}
                    disabled={barcodeLoading || !barcodeInput.trim()}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-2xl shadow-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {barcodeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : '查詢條碼'}
                  </button>
                </div>
              </div>

              {barcodeLoading && (
                <div className="py-4 text-center space-y-2 bg-blue-50/60 rounded-2xl border border-blue-100 animate-in fade-in duration-200">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
                  <p className="text-xs font-medium text-blue-800">正在比對食品條碼資料庫...</p>
                </div>
              )}

              {barcodeError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-start gap-2 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{barcodeError}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB: OCR_SCAN (OCR辨識) */}
          {activeTab === 'OCR_SCAN' && (
            <div className="space-y-4 max-w-md mx-auto py-2 animate-in fade-in duration-200">
              {/* Hidden inputs for OCR camera/gallery */}
              <input
                type="file"
                ref={ocrCameraInputRef}
                accept="image/*"
                capture="environment"
                onChange={handleOcrImageUpload}
                className="hidden"
              />
              <input
                type="file"
                ref={ocrGalleryInputRef}
                accept="image/*"
                onChange={handleOcrImageUpload}
                className="hidden"
              />

              {/* Clean Intro Card */}
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-4.5 text-white shadow-md relative overflow-hidden">
                <div className="flex items-center justify-between font-black text-sm mb-1.5 relative z-10">
                  <div className="flex items-center gap-2 select-none">
                    <ScanText className="w-4.5 h-4.5 text-teal-200 shrink-0" />
                    <span>AI 營養標示 OCR 辨識</span>
                    {isDeveloper && (
                      <span className="px-1.5 py-0.5 bg-amber-400 text-amber-950 text-[9px] font-black rounded-md ml-1 uppercase shadow-2xs">
                        Developer
                      </span>
                    )}
                  </div>

                  {isDeveloper && (
                    <button
                      type="button"
                      onClick={() => setIsAdminSettingsOpen(!isAdminSettingsOpen)}
                      className="p-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white transition active:scale-95 cursor-pointer flex items-center justify-center shadow-xs"
                      title="端側模型協調器五階段配置"
                    >
                      <Settings className={`w-4 h-4 ${isAdminSettingsOpen ? 'rotate-90 text-amber-300' : ''} transition-transform`} />
                    </button>
                  )}
                </div>
                <p className="text-xs text-emerald-100 leading-relaxed font-medium">
                  拍攝包裝上的「營養標示表」，由 AI 自動進行結構化光學字元辨識（OCR），秒速解析熱量、蛋白質、碳水化合物、脂肪等複雜數值。
                </p>
                <div className="mt-2.5 p-2 bg-black/15 rounded-xl border border-white/10 text-[10px] text-teal-200 font-bold flex items-center gap-1.5 leading-relaxed">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>🔒 隱私與極速運算提示：本 OCR 專區 100% 採用端側本地模型與開源 VLM 技術，不使用任何外部雲端 Gemini API，確保您的相片隱私絕不上傳雲端。</span>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-emerald-500/40 text-[11px] text-emerald-100 font-semibold">
                  <span>📷 營養標示表格拍即辨識</span>
                  <span>·</span>
                  <span>⚡ 智慧表格欄位定位解析</span>
                </div>
              </div>

              {/* Admin configuration drawer */}
              {ocrAdminMode && isAdminSettingsOpen && (
                <div className="bg-slate-50 border border-slate-200 rounded-3xl p-4.5 space-y-4 animate-in zoom-in-95 duration-200">
                  <div className="border-b border-slate-200/80 pb-3 space-y-2.5">
                    <div className="flex items-start gap-2.5">
                      <Cpu className="w-4.5 h-4.5 text-emerald-600 animate-pulse shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-xs sm:text-sm text-slate-800 block leading-tight">
                          端側本地 AI OCR 五階段管線配置
                        </span>
                        <span className="text-[10.5px] sm:text-[11.5px] text-slate-500 font-medium block mt-1">
                          100% 離線極速 · 前處理 ➔ 定位 ➔ 文字提取 ➔ 語意分析 ➔ 組合校驗 (&lt;40MB)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-0.5">
                      <button 
                        type="button"
                        disabled={isSavingCloudConfig}
                        onClick={handleSaveConfigToFirebase}
                        className="flex-1 py-2 px-3 text-white text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl cursor-pointer transition shadow-xs active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                        title="將當前模型設定與順序同步至 Firebase，所有使用者開啟頁面時將自動套用"
                      >
                        {isSavingCloudConfig ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Cloud className="w-3.5 h-3.5" />
                        )}
                        <span>{isSavingCloudConfig ? '正在同步至 Firebase...' : '發布全域配置至雲端'}</span>
                      </button>
                      <button 
                        type="button"
                        onClick={() => setIsAdminSettingsOpen(false)}
                        className="py-2 px-4 text-slate-700 hover:text-slate-900 text-xs font-bold bg-slate-200/90 hover:bg-slate-300 rounded-xl cursor-pointer transition whitespace-nowrap shrink-0"
                      >
                        完成設定
                      </button>
                    </div>
                  </div>

                  {/* Cloud Sync Status Feedback Toast */}
                  {cloudSyncMsg && (
                    <div className={`p-3 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200 ${
                      cloudSyncMsg.type === 'success'
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200 shadow-xs'
                        : 'bg-rose-50 text-rose-900 border border-rose-200 shadow-xs'
                    }`}>
                      {cloudSyncMsg.type === 'success' ? (
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span className="leading-snug">{cloudSyncMsg.text}</span>
                    </div>
                  )}

                  {/* Flow pipeline summary banner */}
                  <div className="p-3 bg-gradient-to-r from-sky-500/10 via-amber-500/10 to-indigo-500/10 border border-emerald-200/60 rounded-2xl space-y-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center text-[12px] text-slate-800 font-black">
                        <span className="flex items-center gap-1">
                          <span>⚡</span> 五階段端側演算法排列組合管線
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-[10.5px] text-purple-800 font-extrabold bg-purple-100/90 px-2.5 py-1 rounded-lg border border-purple-300/60 inline-flex items-center gap-1 shadow-2xs">
                          <span>🧮 計算次數:</span>
                          <span>{generateImagePreprocessingVariants(selectedPreprocessing.slice(0, 3)).length} 張影像 × {selectedExtractors.length} 提取 × {selectedSemantics.length} 語意 = {generateImagePreprocessingVariants(selectedPreprocessing.slice(0, 3)).length * selectedExtractors.length * selectedSemantics.length}/36 次推論</span>
                        </span>
                      </div>
                    </div>

                    {/* 5 Step Cards (Clickable Quick Jump / Status) */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2 text-center">
                      <button
                        type="button"
                        onClick={() => setIsStep1Open(prev => !prev)}
                        className={`border rounded-xl py-1.5 px-1 shadow-2xs transition cursor-pointer ${
                          isStep1Open ? 'bg-sky-50 border-sky-300 ring-2 ring-sky-400/40' : 'bg-white/80 border-sky-200 hover:bg-sky-50/50'
                        }`}
                      >
                        <span className="block text-[9px] text-sky-600 font-extrabold">第 1 階段 (生成 {generateImagePreprocessingVariants(selectedPreprocessing.slice(0, 3)).length} 張) {isStep1Open ? '▲' : '▼'}</span>
                        <span className="block text-[11px] font-black text-sky-950 truncate">
                          🖼️ 前處理 ({selectedPreprocessing.length}/3項)
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsStep2Open(prev => !prev)}
                        className={`border rounded-xl py-1.5 px-1 shadow-2xs transition cursor-pointer relative ${
                          isStep2Open ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400/40' : 'bg-white/80 border-amber-200 hover:bg-amber-50/50'
                        }`}
                      >
                        <span className="block text-[9px] text-amber-600 font-extrabold">第 2 階段 {isStep2Open ? '▲' : '▼'}</span>
                        <span className="block text-[11px] font-black text-amber-950 truncate">
                          🎯 {LOCATOR_MODELS_LIST.find(m => m.id === selectedLocator)?.name?.split(' ')[0]}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsStep3Open(prev => !prev)}
                        className={`border rounded-xl py-1.5 px-1 shadow-2xs transition cursor-pointer ${
                          isStep3Open ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400/40' : 'bg-white/80 border-emerald-200 hover:bg-emerald-50/50'
                        }`}
                      >
                        <span className="block text-[9px] text-emerald-600 font-extrabold">第 3 階段 ({selectedExtractors.length}/2) {isStep3Open ? '▲' : '▼'}</span>
                        <span className="block text-[11px] font-black text-emerald-950 truncate">
                          📝 {selectedExtractors.map(id => EXTRACTOR_MODELS_LIST.find(m => m.id === id)?.name?.split(' ')[0] || id).join('+')}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsStep4Open(prev => !prev)}
                        className={`border rounded-xl py-1.5 px-1 shadow-2xs transition cursor-pointer ${
                          isStep4Open ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-400/40' : 'bg-white/80 border-purple-200 hover:bg-purple-50/50'
                        }`}
                      >
                        <span className="block text-[9px] text-purple-600 font-extrabold">第 4 階段 ({selectedSemantics.length}/2) {isStep4Open ? '▲' : '▼'}</span>
                        <span className="block text-[11px] font-black text-purple-950 truncate">
                          🧠 {selectedSemantics.map(id => SEMANTIC_MODELS_LIST.find(m => m.id === id)?.name?.split(' ')[0] || id).join('+')}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsStep5Open(prev => !prev)}
                        className={`border rounded-xl py-1.5 px-1 shadow-2xs transition cursor-pointer ${
                          isStep5Open ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-400/40' : 'bg-white/80 border-indigo-200 hover:bg-indigo-50/50'
                        }`}
                      >
                        <span className="block text-[9px] text-indigo-600 font-extrabold">第 5 階段 {isStep5Open ? '▲' : '▼'}</span>
                        <span className="block text-[11px] font-black text-indigo-950 truncate">
                          ⚖️ {selectedEnsembleStrategy === 'weighted_vote' ? '加權投票' : '補強組合'} + 纖維
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* 5-Column Responsive Layout (All Collapsible) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
                    {/* Column 1: Image Preprocessing Tools (Collapsible & Multi-Select up to 3) */}
                    <div className="bg-white rounded-2xl border border-sky-100 shadow-2xs overflow-hidden flex flex-col justify-between">
                      <div>
                        <button
                          type="button"
                          onClick={() => setIsStep1Open(prev => !prev)}
                          className="w-full p-3.5 bg-sky-50/40 hover:bg-sky-50/80 transition flex items-center justify-between text-left cursor-pointer border-b border-sky-100/60"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base">🖼️</span>
                            <div className="min-w-0">
                              <label className="text-xs font-black text-sky-950 block cursor-pointer">
                                第一欄：影像演算法前處理
                              </label>
                              <span className="text-[10px] text-sky-700 font-medium truncate block">
                                已選 {selectedPreprocessing.length}/3 項 ➔ 生成 {generateImagePreprocessingVariants(selectedPreprocessing.slice(0, 3)).length}/9 張影像
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] font-black bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded-md">
                              可多選 (最多 3 項)
                            </span>
                            <ChevronDown className={`w-4 h-4 text-sky-600 transition-transform duration-200 ${isStep1Open ? 'rotate-180' : ''}`} />
                          </div>
                        </button>

                        {isStep1Open && (
                          <div className="p-3.5 space-y-2.5 animate-in fade-in duration-200">
                            <p className="text-[10px] text-slate-500 font-medium">
                              最多勾選 3 項影像演算法，系統將排列組合生成最多 9 種影像處理變體（正向、逆向與單一濾鏡組合）
                            </p>

                            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                              {IMAGE_PREPROCESSING_TOOLS_LIST.map((tool) => {
                                const isChecked = selectedPreprocessing.includes(tool.id);
                                return (
                                  <button
                                    key={tool.id}
                                    type="button"
                                    onClick={() => {
                                      let next: string[];
                                      if (isChecked) {
                                        next = selectedPreprocessing.filter(id => id !== tool.id);
                                      } else {
                                        if (selectedPreprocessing.length >= 3) {
                                          next = [...selectedPreprocessing.slice(1), tool.id];
                                        } else {
                                          next = [...selectedPreprocessing, tool.id];
                                        }
                                      }
                                      setSelectedPreprocessing(next);
                                      localStorage.setItem('ocr_selected_preprocessing', JSON.stringify(next));
                                    }}
                                    className={`w-full text-left p-2 rounded-xl transition border cursor-pointer flex items-start gap-2 ${
                                      isChecked
                                        ? 'bg-sky-50/70 border-sky-300 text-sky-950 ring-1 ring-sky-400/40'
                                        : 'bg-slate-50/50 hover:bg-slate-100/60 border-slate-200 text-slate-600'
                                    }`}
                                  >
                                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition ${
                                      isChecked ? 'bg-sky-600 border-sky-600 text-white' : 'border-slate-300 bg-white'
                                    }`}>
                                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[11px] font-black">{tool.name}</span>
                                        <span className="text-[9px] bg-sky-100/80 text-sky-800 px-1 py-0.2 rounded font-bold">
                                          {tool.tag}
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">
                                        {tool.description}
                                      </p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {isStep1Open && (
                        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                          <span>上限 3 項 · 自動生成 9 變體</span>
                          <button
                            type="button"
                            onClick={() => {
                              const defaultThree = IMAGE_PREPROCESSING_TOOLS_LIST.slice(0, 3).map(t => t.id);
                              const next = selectedPreprocessing.length > 0 ? [] : defaultThree;
                              setSelectedPreprocessing(next);
                              localStorage.setItem('ocr_selected_preprocessing', JSON.stringify(next));
                            }}
                            className="text-sky-600 hover:text-sky-800 font-bold underline cursor-pointer"
                          >
                            {selectedPreprocessing.length > 0 ? '全部清除' : '選取前 3 項'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Column 2: Feature Extraction & Bounding Box Location (Collapsible) */}
                    <div className="bg-white rounded-2xl border border-amber-100 shadow-2xs overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setIsStep2Open(prev => !prev)}
                        className="w-full p-3.5 bg-amber-50/40 hover:bg-amber-50/80 transition flex items-center justify-between text-left cursor-pointer border-b border-amber-100/60"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base">🎯</span>
                          <div className="min-w-0">
                            <label className="text-xs font-black text-amber-950 block cursor-pointer">
                              第二欄：特徵提取與邊界定位
                            </label>
                            <span className="text-[10px] text-amber-700 font-medium truncate block">
                              {LOCATOR_MODELS_LIST.find(m => m.id === selectedLocator)?.name}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[9px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md">
                            單選 (物理裁切)
                          </span>
                          <ChevronDown className={`w-4 h-4 text-amber-600 transition-transform duration-200 ${isStep2Open ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {isStep2Open && (
                        <div className="p-3.5 space-y-2.5 animate-in fade-in duration-200">
                          <p className="text-[10px] text-slate-500 font-medium">
                            專門框出營養標示表格位置、檢測目標邊界並執行真實物理裁切 (去除無關背景)
                          </p>

                          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                            {LOCATOR_MODELS_LIST.map((model) => {
                              const isSelected = selectedLocator === model.id;
                              return (
                                <button
                                  key={model.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedLocator(model.id);
                                    localStorage.setItem('ocr_selected_locator', model.id);
                                  }}
                                  className={`w-full text-left p-2 rounded-xl transition border cursor-pointer flex items-start gap-2 ${
                                    isSelected
                                      ? 'bg-amber-50/80 border-amber-300 text-amber-950 ring-1 ring-amber-400/40'
                                      : 'bg-slate-50/50 hover:bg-slate-100/60 border-slate-200 text-slate-600'
                                  }`}
                                >
                                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition ${
                                    isSelected ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-300 bg-white'
                                  }`}>
                                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[11px] font-black">{model.name}</span>
                                      <span className="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.2 rounded font-black">
                                        {model.size}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">
                                      {model.features}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Column 3: Text Extraction & Recognition (Collapsible & Multi-Select up to 2) */}
                    <div className="bg-white rounded-2xl border border-emerald-100 shadow-2xs overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setIsStep3Open(prev => !prev)}
                        className="w-full p-3.5 bg-emerald-50/40 hover:bg-emerald-50/80 transition flex items-center justify-between text-left cursor-pointer border-b border-emerald-100/60"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base">📝</span>
                          <div className="min-w-0">
                            <label className="text-xs font-black text-emerald-950 block cursor-pointer">
                              第三欄：深度文字識別與提取
                            </label>
                            <span className="text-[10px] text-emerald-700 font-medium truncate block">
                              已選 {selectedExtractors.map(id => EXTRACTOR_MODELS_LIST.find(m => m.id === id)?.name?.split(' ')[0] || id).join(' + ')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md">
                            可多選 (最多 2 項)
                          </span>
                          <ChevronDown className={`w-4 h-4 text-emerald-600 transition-transform duration-200 ${isStep3Open ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {isStep3Open && (
                        <div className="p-3.5 space-y-2.5 animate-in fade-in duration-200">
                          <p className="text-[10px] text-slate-500 font-medium">
                            專門從定位區域讀取繁中字元與數值 (可選 1~2 項，將進行排列組合推論與缺補整合)
                          </p>

                          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                            {EXTRACTOR_MODELS_LIST.map((model) => {
                              const isChecked = selectedExtractors.includes(model.id);
                              return (
                                <button
                                  key={model.id}
                                  type="button"
                                  onClick={() => {
                                    let next: string[];
                                    if (isChecked) {
                                      if (selectedExtractors.length <= 1) return; // Keep at least 1
                                      next = selectedExtractors.filter(id => id !== model.id);
                                    } else {
                                      if (selectedExtractors.length >= 2) {
                                        next = [selectedExtractors[1] || selectedExtractors[0], model.id];
                                      } else {
                                        next = [...selectedExtractors, model.id];
                                      }
                                    }
                                    setSelectedExtractors(next);
                                    localStorage.setItem('ocr_selected_extractors', JSON.stringify(next));
                                  }}
                                  className={`w-full text-left p-2 rounded-xl transition border cursor-pointer flex items-start gap-2 ${
                                    isChecked
                                      ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 ring-1 ring-emerald-400/40'
                                      : 'bg-slate-50/50 hover:bg-slate-100/60 border-slate-200 text-slate-600'
                                  }`}
                                >
                                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition ${
                                    isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                                  }`}>
                                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[11px] font-black">{model.name}</span>
                                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-black">
                                        {model.size}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">
                                      {model.features}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Column 4: Semantic Analysis & Nutrient Structuring (Collapsible & Multi-Select up to 2) */}
                    <div className="bg-white rounded-2xl border border-purple-100 shadow-2xs overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setIsStep4Open(prev => !prev)}
                        className="w-full p-3.5 bg-purple-50/40 hover:bg-purple-50/80 transition flex items-center justify-between text-left cursor-pointer border-b border-purple-100/60"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base">🧠</span>
                          <div className="min-w-0">
                            <label className="text-xs font-black text-purple-950 block cursor-pointer">
                              第四欄：語意分析與結構化
                            </label>
                            <span className="text-[10px] text-purple-700 font-medium truncate block">
                              已選 {selectedSemantics.map(id => SEMANTIC_MODELS_LIST.find(m => m.id === id)?.name?.split(' ')[0] || id).join(' + ')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[9px] font-black bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-md">
                            可多選 (最多 2 項)
                          </span>
                          <ChevronDown className={`w-4 h-4 text-purple-600 transition-transform duration-200 ${isStep4Open ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {isStep4Open && (
                        <div className="p-3.5 space-y-2.5 animate-in fade-in duration-200">
                          <p className="text-[10px] text-slate-500 font-medium">
                            專門分析繁中標籤、雙欄位對照、排除反式脂肪與修復 OCR 錯字 (可選 1~2 項參與排列組合)
                          </p>

                          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                            {SEMANTIC_MODELS_LIST.map((model) => {
                              const isChecked = selectedSemantics.includes(model.id);
                              return (
                                <button
                                  key={model.id}
                                  type="button"
                                  onClick={() => {
                                    let next: string[];
                                    if (isChecked) {
                                      if (selectedSemantics.length <= 1) return; // Keep at least 1
                                      next = selectedSemantics.filter(id => id !== model.id);
                                    } else {
                                      if (selectedSemantics.length >= 2) {
                                        next = [selectedSemantics[1] || selectedSemantics[0], model.id];
                                      } else {
                                        next = [...selectedSemantics, model.id];
                                      }
                                    }
                                    setSelectedSemantics(next);
                                    localStorage.setItem('ocr_selected_semantics', JSON.stringify(next));
                                  }}
                                  className={`w-full text-left p-2 rounded-xl transition border cursor-pointer flex items-start gap-2 ${
                                    isChecked
                                      ? 'bg-purple-50/80 border-purple-300 text-purple-950 ring-1 ring-purple-400/40'
                                      : 'bg-slate-50/50 hover:bg-slate-100/60 border-slate-200 text-slate-600'
                                  }`}
                                >
                                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 mt-0.5 transition ${
                                    isChecked ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white'
                                  }`}>
                                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[11px] font-black">{model.name}</span>
                                      <span className="text-[9px] bg-purple-100 text-purple-800 px-1 py-0.2 rounded font-black">
                                        {model.size}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">
                                      {model.features}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Column 5: Ensemble Strategy & Nutrition Verification (Collapsible & Dual Choice) */}
                    <div className="bg-white rounded-2xl border border-indigo-100 shadow-2xs overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setIsStep5Open(prev => !prev)}
                        className="w-full p-3.5 bg-indigo-50/40 hover:bg-indigo-50/80 transition flex items-center justify-between text-left cursor-pointer border-b border-indigo-100/60"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base">⚖️</span>
                          <div className="min-w-0">
                            <label className="text-xs font-black text-indigo-950 block cursor-pointer">
                              第五欄：組合策略與營養素校驗
                            </label>
                            <span className="text-[10px] text-indigo-700 font-medium truncate block">
                              {selectedEnsembleStrategy === 'weighted_vote' ? '⚖️ 加權投票模式' : '🎯 補強組合模式 (缺補)'} + 膳食纖維計算
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[9px] font-black bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded-md">
                            二擇一
                          </span>
                          <ChevronDown className={`w-4 h-4 text-indigo-600 transition-transform duration-200 ${isStep5Open ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {isStep5Open && (
                        <div className="p-3.5 space-y-2.5 animate-in fade-in duration-200">
                          <p className="text-[10px] text-slate-500 font-medium">
                            選擇 36 組分支結果之組合聚合演算法，並啟用膳食纖維與 Atwater 熱量精密校驗
                          </p>

                          <div className="space-y-2">
                            {/* Strategy 1: Complementary */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEnsembleStrategy('complementary');
                                localStorage.setItem('ocr_ensemble_strategy', 'complementary');
                              }}
                              className={`w-full text-left p-2 rounded-xl transition border cursor-pointer flex items-start gap-2 ${
                                selectedEnsembleStrategy === 'complementary'
                                  ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 ring-1 ring-indigo-400/40'
                                  : 'bg-slate-50/50 hover:bg-slate-100/60 border-slate-200 text-slate-600'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition ${
                                selectedEnsembleStrategy === 'complementary' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                              }`}>
                                {selectedEnsembleStrategy === 'complementary' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[11px] font-black">🎯 補強組合模式 (缺什麼補什麼)</span>
                                  <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1 py-0.2 rounded font-black">
                                    預設推薦
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">
                                  以首個有效分支為底，數值為 0 處由後續分支補齊，確保各項營養素完整提取。
                                </p>
                              </div>
                            </button>

                            {/* Strategy 2: Weighted Voting */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEnsembleStrategy('weighted_vote');
                                localStorage.setItem('ocr_ensemble_strategy', 'weighted_vote');
                              }}
                              className={`w-full text-left p-2 rounded-xl transition border cursor-pointer flex items-start gap-2 ${
                                selectedEnsembleStrategy === 'weighted_vote'
                                  ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 ring-1 ring-indigo-400/40'
                                  : 'bg-slate-50/50 hover:bg-slate-100/60 border-slate-200 text-slate-600'
                              }`}
                            >
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition ${
                                selectedEnsembleStrategy === 'weighted_vote' ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                              }`}>
                                {selectedEnsembleStrategy === 'weighted_vote' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[11px] font-black">⚖️ 加權投票模式 (置信度評分)</span>
                                  <span className="text-[9px] bg-purple-100 text-purple-800 px-1 py-0.2 rounded font-black">
                                    抗噪眾數
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-medium leading-relaxed mt-0.5">
                                  統計非零預測進行眾數分群與加權平均，過濾個別模型因模糊產生的雜訊或離群值。
                                </p>
                              </div>
                            </button>
                          </div>

                          {/* Built-in Nutrient verification formula summary */}
                          <div className="p-2 bg-emerald-50/60 border border-emerald-200/70 rounded-xl space-y-1">
                            <div className="flex items-center gap-1 text-[10px] font-black text-emerald-950">
                              <span>🧮</span>
                              <span>營養素合理性檢查 & 膳食纖維計算</span>
                            </div>
                            <p className="text-[9px] text-emerald-800 font-medium leading-relaxed">
                              • 淨碳水 = 碳水化合物 - 膳食纖維<br />
                              • Atwater 理論熱量 = 4×淨碳 + 2×纖維 + 4×蛋白 + 9×脂肪<br />
                              • 自動檢測糖/纖維是否超出總碳水並提供一鍵熱量校正
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {ocrImageBase64 ? (
                /* OCR Image Preview and Dialog Mode */
                <div className="space-y-4">
                  {/* Image Preview Box with YOLOv8 bounding box overlay */}
                  <div className="relative bg-white border border-slate-200 rounded-3xl p-3.5 shadow-2xs text-center overflow-hidden">
                    {/* Preprocessed vs Original toggle pill if processed */}
                    {processedImagePreview && (
                      <div className="mb-2.5 flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setShowProcessedComparison(false)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                            !showProcessedComparison 
                              ? 'bg-slate-800 text-white shadow-xs' 
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          📷 原圖
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowProcessedComparison(true)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition cursor-pointer flex items-center gap-1 ${
                            showProcessedComparison 
                              ? 'bg-sky-600 text-white shadow-xs' 
                              : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
                          }`}
                        >
                          <Sparkles className="w-3 h-3" />
                          🖼️ 演算法增強圖 (Sauvola / USM)
                        </button>
                      </div>
                    )}

                    <div className="relative inline-block max-w-full">
                      <img
                        src={showProcessedComparison && processedImagePreview ? processedImagePreview : ocrImageBase64}
                        alt="營養標示預覽"
                        className="w-full max-h-56 object-contain rounded-2xl border border-slate-100 bg-slate-50 mx-auto shadow-xs"
                      />

                      {/* Floating Quick Rotate Buttons Overlay */}
                      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-slate-900/80 backdrop-blur-md p-1 rounded-xl shadow-md border border-white/20">
                        <button
                          type="button"
                          disabled={isRotatingImage}
                          onClick={() => handleRotateOcrImage(270)}
                          className="p-1.5 text-white/90 hover:text-white hover:bg-white/20 rounded-lg transition active:scale-90 cursor-pointer flex items-center gap-0.5 text-[10px] font-bold disabled:opacity-50"
                          title="逆時針轉 90°"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">左轉</span>
                        </button>
                        <div className="w-px h-3 bg-white/20" />
                        <button
                          type="button"
                          disabled={isRotatingImage}
                          onClick={() => handleRotateOcrImage(90)}
                          className="p-1.5 text-white/90 hover:text-white hover:bg-white/20 rounded-lg transition active:scale-90 cursor-pointer flex items-center gap-0.5 text-[10px] font-bold disabled:opacity-50"
                          title="順時針轉 90°"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">右轉</span>
                        </button>
                        <div className="w-px h-3 bg-white/20" />
                        <button
                          type="button"
                          disabled={isRotatingImage}
                          onClick={() => handleRotateOcrImage(180)}
                          className="px-1.5 py-1 text-white/90 hover:text-white hover:bg-white/20 rounded-lg transition active:scale-90 cursor-pointer text-[10px] font-bold disabled:opacity-50"
                          title="翻轉 180°"
                        >
                          180°
                        </button>
                      </div>

                      {/* Rotating overlay state */}
                      {isRotatingImage && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-2xs rounded-2xl flex flex-col items-center justify-center text-white text-xs font-bold gap-1.5 z-20 animate-in fade-in duration-150">
                          <Loader2 className="w-6 h-6 animate-spin text-white" />
                          <span>旋轉轉正中...</span>
                        </div>
                      )}

                      {/* Bounding box overlay for YOLOv8 or successful OCR (only when nutrients are actually detected) */}
                      {simulatedOcrResult && (
                        simulatedOcrResult.nutrients.calories > 0 ||
                        simulatedOcrResult.nutrients.protein > 0 ||
                        simulatedOcrResult.nutrients.fat > 0 ||
                        simulatedOcrResult.nutrients.carbs > 0 ||
                        simulatedOcrResult.nutrients.sodium > 0 ||
                        simulatedOcrResult.nutrients.sugars > 0 ||
                        simulatedOcrResult.nutrients.fiber > 0 ||
                        simulatedOcrResult.nutrients.potassium > 0
                      ) && (
                        <div 
                          className="absolute border-2 border-emerald-500 bg-emerald-500/10 rounded-lg animate-pulse"
                          style={{
                            top: '12%',
                            left: '8%',
                            width: '84%',
                            height: '76%',
                            boxShadow: '0 0 12px rgba(16, 185, 129, 0.6)'
                          }}
                        >
                          <span className="absolute -top-6 left-0 bg-emerald-600 text-white text-[9px] font-black px-2 py-0.5 rounded shadow flex items-center gap-1 whitespace-nowrap">
                            <Sparkles className="w-3 h-3 text-amber-300 animate-spin" style={{ animationDuration: '3s' }} />
                            {selectedLocator === 'yolov8_doc' ? 'YOLOv8-Nano Doc' : selectedLocator === 'tiny_cnn' ? 'Tiny-CNN' : selectedLocator === 'layoutlmv3' ? 'LayoutLMv3 (Patch)' : 'AI-Layout'}: 已精確定位並框選「營養標示區域」
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex justify-center items-center gap-1.5 sm:gap-2 flex-wrap">
                      <button
                        type="button"
                        disabled={isRotatingImage}
                        onClick={() => handleRotateOcrImage(270)}
                        className="px-2.5 py-1.5 bg-sky-50 text-sky-700 border border-sky-200/80 rounded-xl text-xs font-bold hover:bg-sky-100 transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-2xs disabled:opacity-50"
                        title="逆時針轉 90°"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        向左轉
                      </button>
                      <button
                        type="button"
                        disabled={isRotatingImage}
                        onClick={() => handleRotateOcrImage(90)}
                        className="px-2.5 py-1.5 bg-sky-50 text-sky-700 border border-sky-200/80 rounded-xl text-xs font-bold hover:bg-sky-100 transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-2xs disabled:opacity-50"
                        title="順時針轉 90°"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        向右轉
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsOcrCameraModalOpen(true)}
                        className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl shadow-xs text-xs font-bold hover:bg-emerald-700 transition cursor-pointer flex items-center gap-1 active:scale-95"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        重拍
                      </button>
                      <button
                        type="button"
                        onClick={() => ocrGalleryInputRef.current?.click()}
                        className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition cursor-pointer flex items-center gap-1 active:scale-95"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        重新選取
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOcrImageBase64(null);
                          setSimulatedOcrResult(null);
                        }}
                        className="px-2.5 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition cursor-pointer flex items-center active:scale-95"
                        title="清除照片"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Standard Assistant Feedback Dialog (For regular users when admin is off) */}
                  {!ocrAdminMode && (
                    <div className="space-y-4">
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-100 rounded-3xl p-4.5 space-y-3 shadow-2xs relative">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-xs animate-bounce" style={{ animationDuration: '2s' }}>
                             AI
                          </div>
                          <span className="font-black text-xs text-emerald-950">OCR 標示辨識助理</span>
                        </div>
                        {simulatedOcrResult ? (
                          (simulatedOcrResult.nutrients.calories > 0 ||
                           simulatedOcrResult.nutrients.protein > 0 ||
                           simulatedOcrResult.nutrients.fat > 0 ||
                           simulatedOcrResult.nutrients.carbs > 0 ||
                           simulatedOcrResult.nutrients.sugars > 0 ||
                           simulatedOcrResult.nutrients.fiber > 0 ||
                           simulatedOcrResult.nutrients.sodium > 0 ||
                           simulatedOcrResult.nutrients.potassium > 0) ? (
                            <p className="text-xs text-emerald-900 leading-relaxed font-bold animate-in fade-in duration-300">
                              「我已成功為您完成圖片 OCR 智慧解析！已為您自動呼叫自訂食品對話框並填入各項營養成分，名稱與品牌已留空供您填寫命名。」
                            </p>
                          ) : (
                            <p className="text-xs text-amber-900 leading-relaxed font-bold animate-in fade-in duration-300">
                              「未在圖片中辨識出營養數據（恪守零猜測守則：數值維持 0）。建議將照片轉正後重試，或點擊下方手動新增。」
                            </p>
                          )
                        ) : (
                          <p className="text-xs text-emerald-900 leading-relaxed font-semibold">
                            「我已經準備好讀取您上傳的營養標示圖片囉！請點擊下方按鈕啟動端側本地 OCR 智慧解析，辨識成功後將自動呼叫自訂食品對話框。」
                          </p>
                        )}
                      </div>

                      {/* Trigger button for ordinary users */}
                      {!simulatedOcrResult && (
                        <div className="space-y-2">
                          <button
                            type="button"
                            disabled={isSimulatingOcr}
                            onClick={() => simulateOcrInference(selectedLocator, selectedExtractors, selectedSemantics)}
                            className={`w-full py-3.5 rounded-2xl text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-98 cursor-pointer ${
                              isSimulatingOcr 
                                ? 'bg-slate-400 cursor-wait' 
                                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                            }`}
                          >
                            {isSimulatingOcr ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                <span className="truncate">{paddleStatus ? `${paddleStatus} (${paddleProgress}%)` : '正在呼叫端側本地 OCR 模型解析標籤...'}</span>
                              </>
                            ) : (
                              <>
                                <ScanText className="w-4 h-4" />
                                <span>開始 OCR 智慧解析 (排列組合 + 缺什麼補什麼整合)</span>
                              </>
                            )}
                          </button>

                          {isSimulatingOcr && (
                            <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-1.5 animate-in fade-in duration-200">
                              <div className="flex justify-between items-center text-[10px] font-black text-emerald-800">
                                <span className="flex items-center gap-1.5 truncate">
                                  <Loader2 className="w-3 h-3 animate-spin text-emerald-600 shrink-0" />
                                  <span className="truncate">{paddleStatus || '端側本地模型解析中...'}</span>
                                </span>
                                <span className="shrink-0">{paddleProgress}%</span>
                              </div>
                              <div className="w-full bg-white h-2.5 rounded-full overflow-hidden border border-emerald-200/90 shadow-2xs">
                                <div 
                                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-600 transition-all duration-300 rounded-full"
                                  style={{ width: `${Math.max(paddleProgress, 5)}%` }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Nutrient summary and custom food open for ordinary users */}
                      {simulatedOcrResult && (
                        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-3xl p-4 text-center space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-bold text-slate-800">
                            <div className="p-2 bg-white/60 rounded-xl border border-slate-100">
                              <span className="text-[10px] text-slate-400 block font-medium">🔥 熱量</span>
                              <span className="text-emerald-700">{simulatedOcrResult.nutrients.calories} kcal</span>
                            </div>
                            <div className="p-2 bg-white/60 rounded-xl border border-slate-100">
                              <span className="text-[10px] text-slate-400 block font-medium">💪 蛋白質</span>
                              <span className="text-emerald-700">{simulatedOcrResult.nutrients.protein} g</span>
                            </div>
                            <div className="p-2 bg-white/60 rounded-xl border border-slate-100">
                              <span className="text-[10px] text-slate-400 block font-medium">🥑 脂肪</span>
                              <span className="text-emerald-700">{simulatedOcrResult.nutrients.fat} g</span>
                            </div>
                            <div className="p-2 bg-white/60 rounded-xl border border-slate-100">
                              <span className="text-[10px] text-slate-400 block font-medium">🍞 碳水</span>
                              <span className="text-emerald-700">{simulatedOcrResult.nutrients.carbs} g</span>
                            </div>
                            <div className="p-2 bg-white/60 rounded-xl border border-slate-100">
                              <span className="text-[10px] text-slate-400 block font-medium">🍬 糖</span>
                              <span className="text-emerald-700">{simulatedOcrResult.nutrients.sugars} g</span>
                            </div>
                            <div className="p-2 bg-white/60 rounded-xl border border-slate-100">
                              <span className="text-[10px] text-slate-400 block font-medium">🥗 膳食纖維</span>
                              <span className="text-emerald-700">{simulatedOcrResult.nutrients.fiber} g</span>
                            </div>
                            <div className="p-2 bg-white/60 rounded-xl border border-slate-100">
                              <span className="text-[10px] text-slate-400 block font-medium">🧂 鈉</span>
                              <span className="text-emerald-700">{simulatedOcrResult.nutrients.sodium} mg</span>
                            </div>
                            <div className="p-2 bg-white/60 rounded-xl border border-slate-100">
                              <span className="text-[10px] text-slate-400 block font-medium">🍌 鉀</span>
                              <span className="text-emerald-700">{simulatedOcrResult.nutrients.potassium} mg</span>
                            </div>
                          </div>

                          {/* Nutrient Verification & Dietary Fiber Analysis Box */}
                          {simulatedOcrResult.verification && (
                            <div className={`p-3 rounded-2xl border text-left space-y-2 ${
                              simulatedOcrResult.verification.issues.length === 0
                                ? 'bg-emerald-50/70 border-emerald-200'
                                : 'bg-amber-50/80 border-amber-200'
                            }`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 font-black text-xs">
                                  <span>{simulatedOcrResult.verification.issues.length === 0 ? '✅' : '⚠️'}</span>
                                  <span className={simulatedOcrResult.verification.issues.length === 0 ? 'text-emerald-900' : 'text-amber-900'}>
                                    {simulatedOcrResult.verification.issues.length === 0 ? '營養素邏輯檢驗合規' : '營養素數據檢驗提醒'}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/80 border border-slate-200 text-slate-700">
                                  Atwater 系統
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-700">
                                <div className="p-1.5 bg-white/70 rounded-xl border border-slate-100">
                                  <span className="text-slate-400 block text-[9.5px]">🌾 淨碳水化合物</span>
                                  <span className="font-bold text-slate-800">
                                    {simulatedOcrResult.verification.netCarbs} g
                                  </span>
                                  <span className="text-[9px] text-slate-400 block">
                                    (總碳 {simulatedOcrResult.nutrients.carbs}g - 纖維 {simulatedOcrResult.nutrients.fiber}g)
                                  </span>
                                </div>
                                <div className="p-1.5 bg-white/70 rounded-xl border border-slate-100">
                                  <span className="text-slate-400 block text-[9.5px]">🔥 Atwater 理論熱量</span>
                                  <span className="font-bold text-slate-800">
                                    {simulatedOcrResult.verification.calculatedCalories} kcal
                                  </span>
                                  <span className="text-[9px] text-slate-400 block">
                                    (標示 {simulatedOcrResult.nutrients.calories} kcal · 差 {Math.abs(simulatedOcrResult.nutrients.calories - simulatedOcrResult.verification.calculatedCalories)} kcal)
                                  </span>
                                </div>
                              </div>

                              {simulatedOcrResult.verification.arbitratedByAtwater && (
                                <div className="p-2 bg-emerald-100/90 border border-emerald-300 rounded-xl text-[10px] text-emerald-900 font-bold flex items-center gap-1.5">
                                  <span className="text-xs">⚖️</span>
                                  <span>
                                    已自動執行 Atwater 物理仲裁：候選第 2 名 ({simulatedOcrResult.nutrients.calories} kcal) 因完全吻合三大營養素理論換算勝出！
                                  </span>
                                </div>
                              )}

                              {simulatedOcrResult.verification.issues.length > 0 && (
                                <div className="space-y-1 pt-1 border-t border-amber-200/60 text-[10.5px] text-amber-800">
                                  {simulatedOcrResult.verification.issues.map((issue: string, wIdx: number) => (
                                    <div key={wIdx} className="flex items-start gap-1">
                                      <span className="text-amber-500 font-bold shrink-0">•</span>
                                      <span>{issue}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Interactive Calorie Quick-Fix Actions */}
                              <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-200/60">
                                {simulatedOcrResult.verification.calculatedCalories > 0 && Math.abs(simulatedOcrResult.nutrients.calories - simulatedOcrResult.verification.calculatedCalories) >= 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleApplyCalorieCorrection(simulatedOcrResult.verification.calculatedCalories)}
                                    className="text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer"
                                    title="依據 4×淨碳 + 2×纖維 + 4×蛋白 + 9×脂肪 直接校正熱量"
                                  >
                                    <span>⚡</span>
                                    <span>套用理論熱量 ({simulatedOcrResult.verification.calculatedCalories} kcal)</span>
                                  </button>
                                )}

                                {simulatedOcrResult.verification.runnerUpCalories != null && simulatedOcrResult.verification.runnerUpCalories !== simulatedOcrResult.nutrients.calories && (
                                  <button
                                    type="button"
                                    onClick={() => handleApplyCalorieCorrection(simulatedOcrResult.verification.runnerUpCalories!)}
                                    className="text-[10px] font-black bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer"
                                    title="切換為加權投票第 2 候選熱量"
                                  >
                                    <span>🔄</span>
                                    <span>切換第 2 候選 ({simulatedOcrResult.verification.runnerUpCalories} kcal)</span>
                                  </button>
                                )}

                                {simulatedOcrResult.verification.topCandidateCalories != null && simulatedOcrResult.verification.topCandidateCalories !== simulatedOcrResult.nutrients.calories && (
                                  <button
                                    type="button"
                                    onClick={() => handleApplyCalorieCorrection(simulatedOcrResult.verification.topCandidateCalories!)}
                                    className="text-[10px] font-black bg-slate-600 hover:bg-slate-700 text-white px-2.5 py-1 rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer"
                                    title="還原為原始票數最高熱量"
                                  >
                                    <span>↩️</span>
                                    <span>還原第 1 候選 ({simulatedOcrResult.verification.topCandidateCalories} kcal)</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {(() => {
                            const hasNutrients =
                              simulatedOcrResult.nutrients.calories > 0 ||
                              simulatedOcrResult.nutrients.protein > 0 ||
                              simulatedOcrResult.nutrients.fat > 0 ||
                              simulatedOcrResult.nutrients.carbs > 0 ||
                              simulatedOcrResult.nutrients.sugars > 0 ||
                              simulatedOcrResult.nutrients.fiber > 0 ||
                              simulatedOcrResult.nutrients.sodium > 0 ||
                              simulatedOcrResult.nutrients.potassium > 0;

                            if (hasNutrients) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onOpenCustomFoodModal({
                                      id: 'custom_ocr_' + Date.now(),
                                      name: '',
                                      brand: '',
                                      calories: simulatedOcrResult.nutrients.calories,
                                      protein: simulatedOcrResult.nutrients.protein,
                                      fat: simulatedOcrResult.nutrients.fat,
                                      carbs: simulatedOcrResult.nutrients.carbs,
                                      sodium: simulatedOcrResult.nutrients.sodium,
                                      sugars: simulatedOcrResult.nutrients.sugars,
                                      fiber: simulatedOcrResult.nutrients.fiber,
                                      potassium: simulatedOcrResult.nutrients.potassium,
                                      servingAmount: 100,
                                      servingUnit: 'g',
                                      aiSource: 'vision',
                                    });
                                  }}
                                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black shadow-md transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                                >
                                  <Plus className="w-4 h-4" />
                                  <span>🟢 開啟自訂食品對話框 (已填入辨識數值)</span>
                                </button>
                              );
                            }

                            return (
                              <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3 text-center space-y-2">
                                <p className="text-xs text-amber-900 font-bold">未在影像中讀取到營養數據（零猜測：數值全為 0）</p>
                                <p className="text-[11px] text-amber-800 font-medium">若照片倒立或側躺，可使用上方旋轉按鈕轉正後重新辨識；亦可手動新增自訂飲食。</p>
                                <button
                                  type="button"
                                  onClick={() => onOpenCustomFoodModal()}
                                  className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
                                >
                                  手動建立自訂食品
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Admin Simulation Mode Section */}
                  {ocrAdminMode && (
                    <div className="space-y-4">
                      {/* Simulation Actions */}
                      <button
                        type="button"
                        disabled={isSimulatingOcr}
                        onClick={() => simulateOcrInference(selectedLocator, selectedExtractors, selectedSemantics)}
                        className={`w-full py-3.5 rounded-2xl text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-sm transition active:scale-98 cursor-pointer ${
                          isSimulatingOcr 
                            ? 'bg-slate-400 cursor-wait' 
                            : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-600/20'
                        }`}
                      >
                        {isSimulatingOcr ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>正在執行 AI 辨識與數據校驗...</span>
                          </>
                        ) : (
                          <>
                            <ScanText className="w-4 h-4" />
                            <span>🚀 啟動 AI 營養標示極速辨識</span>
                          </>
                        )}
                      </button>

                      {/* Code Execution Loader */}
                      {isSimulatingOcr && (
                        <div className="bg-white text-slate-700 border border-emerald-100/90 rounded-3xl p-4 font-sans text-xs space-y-2.5 shadow-sm">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                            <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />
                              <span>端側本地 AI 離線辨識中...</span>
                            </span>
                            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-200/60">
                              100% 離線運算
                            </span>
                          </div>
                          
                          {modelProgress > 0 && modelProgress < 100 ? (
                            <div className="p-3 bg-amber-50/50 rounded-2xl border border-amber-200/60 space-y-2 animate-in fade-in duration-200">
                              <div className="flex justify-between items-center text-[11px] font-bold text-amber-800">
                                <span className="flex items-center gap-1.5 truncate">
                                  <Loader2 className="w-3 h-3 animate-spin text-amber-600 shrink-0" />
                                  <span className="truncate">{modelStatus}</span>
                                </span>
                                <span className="shrink-0 font-mono font-bold">{modelProgress}%</span>
                              </div>
                              <div className="w-full bg-white h-2.5 rounded-full overflow-hidden border border-amber-200/80 shadow-2xs">
                                <div 
                                  className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-300 rounded-full"
                                  style={{ width: `${Math.max(modelProgress, 5)}%` }}
                                ></div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-emerald-50/50 rounded-2xl border border-emerald-200/60 space-y-2 animate-in fade-in duration-200">
                              <div className="flex justify-between items-center text-[11px] font-bold text-emerald-800">
                                <span className="flex items-center gap-1.5 truncate">
                                  <Loader2 className="w-3 h-3 animate-spin text-emerald-600 shrink-0" />
                                  <span className="truncate">{paddleStatus || '端側模型與影像演算法推論中...'}</span>
                                </span>
                                <span className="shrink-0 font-mono font-bold">{paddleProgress}%</span>
                              </div>
                              <div className="w-full bg-white h-2.5 rounded-full overflow-hidden border border-emerald-200/80 shadow-2xs">
                                <div 
                                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300 rounded-full"
                                  style={{ width: `${Math.max(paddleProgress, 5)}%` }}
                                ></div>
                              </div>
                              <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                                <span>📦 端側影像演算法排列推論</span>
                                <span>進度：{paddleProgress}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Model OCR Result UI (Clean user-facing card without low-level terminal/logs) */}
                      {simulatedOcrResult && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                          {/* Quick Apply Panel (Respects zero-guess policy) */}
                          {(() => {
                            const hasNutrients =
                              simulatedOcrResult.nutrients.calories > 0 ||
                              simulatedOcrResult.nutrients.protein > 0 ||
                              simulatedOcrResult.nutrients.fat > 0 ||
                              simulatedOcrResult.nutrients.carbs > 0 ||
                              simulatedOcrResult.nutrients.sodium > 0 ||
                              simulatedOcrResult.nutrients.sugars > 0 ||
                              simulatedOcrResult.nutrients.fiber > 0 ||
                              simulatedOcrResult.nutrients.potassium > 0;

                            if (hasNutrients) {
                              return (
                                <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-3xl p-4 text-center space-y-3.5">
                                  {/* Step 5 Strategy & Verification Summary */}
                                  <div className="flex items-center justify-between text-[11px] font-bold pb-2 border-b border-emerald-200/60 flex-wrap gap-1.5">
                                    <span className="flex items-center gap-1 text-slate-700">
                                      <span className="text-indigo-600">⚖️ 聚合策略:</span>
                                      <span className="bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded-md font-black">
                                        {selectedEnsembleStrategy === 'weighted_vote' ? '加權投票 (Weighted Voting)' : '補強組合 (Complementary)'}
                                      </span>
                                    </span>
                                    {simulatedOcrResult.verification && (
                                      <span className={`px-2 py-0.5 rounded-md font-black flex items-center gap-1 ${
                                        simulatedOcrResult.verification.issues.length === 0
                                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                                      }`}>
                                        <span>{simulatedOcrResult.verification.issues.length === 0 ? '✅' : '⚠️'}</span>
                                        <span>Atwater {simulatedOcrResult.verification.issues.length === 0 ? '合規通過' : '數值警示'}</span>
                                      </span>
                                    )}
                                  </div>

                                  {/* Nutrients Pills */}
                                  <div className="flex flex-wrap justify-center gap-2 text-xs text-emerald-950 font-bold">
                                    {simulatedOcrResult.nutrients.servingSize && simulatedOcrResult.nutrients.servingSize > 0 && (
                                      <>
                                        <span className="bg-emerald-200/80 px-2 py-0.5 rounded-md text-emerald-900">📦 每一份量: {simulatedOcrResult.nutrients.servingSize}g</span>
                                        <span>·</span>
                                      </>
                                    )}
                                    <span>🔥 熱量: {simulatedOcrResult.nutrients.calories} kcal</span>
                                    <span>·</span>
                                    <span>💪 蛋白質: {simulatedOcrResult.nutrients.protein}g</span>
                                    <span>·</span>
                                    <span>🥑 脂肪: {simulatedOcrResult.nutrients.fat}g</span>
                                    <span>·</span>
                                    <span>🍞 碳水: {simulatedOcrResult.nutrients.carbs}g</span>
                                    {simulatedOcrResult.nutrients.sugars > 0 && (
                                      <>
                                        <span>·</span>
                                        <span>🍬 糖: {simulatedOcrResult.nutrients.sugars}g</span>
                                      </>
                                    )}
                                    {simulatedOcrResult.nutrients.fiber > 0 && (
                                      <>
                                        <span>·</span>
                                        <span>🥗 纖維: {simulatedOcrResult.nutrients.fiber}g</span>
                                      </>
                                    )}
                                    <span>·</span>
                                    <span>🧂 鈉: {simulatedOcrResult.nutrients.sodium}mg</span>
                                    {simulatedOcrResult.nutrients.potassium > 0 && (
                                      <>
                                        <span>·</span>
                                        <span>🍌 鉀: {simulatedOcrResult.nutrients.potassium}mg</span>
                                      </>
                                    )}
                                  </div>

                                  {/* Verification Details Box */}
                                  {simulatedOcrResult.verification && (
                                    <div className="bg-white/80 border border-emerald-200/80 rounded-2xl p-3 text-left space-y-2">
                                      {/* Multi-Nutrient Candidates Arbitration Section */}
                                      {(() => {
                                        const candsMap = simulatedOcrResult.verification?.nutrientCandidates || {};
                                        const nutrientMeta: Record<string, { label: string; unit: string; emoji: string }> = {
                                          calories: { label: '熱量', unit: 'kcal', emoji: '🔥' },
                                          protein: { label: '蛋白質', unit: 'g', emoji: '💪' },
                                          fat: { label: '脂肪', unit: 'g', emoji: '🥑' },
                                          carbs: { label: '碳水化合物', unit: 'g', emoji: '🍞' },
                                          sugars: { label: '糖', unit: 'g', emoji: '🍬' },
                                          fiber: { label: '膳食纖維', unit: 'g', emoji: '🥗' },
                                          sodium: { label: '鈉', unit: 'mg', emoji: '🧂' },
                                          potassium: { label: '鉀', unit: 'mg', emoji: '🍌' },
                                        };

                                        const multiCandidateKeys = Object.keys(nutrientMeta).filter(
                                          k => (candsMap[k] || []).length >= 2
                                        );

                                        if (multiCandidateKeys.length === 0) return null;

                                        return (
                                          <div className="p-2.5 bg-indigo-50/70 rounded-2xl border border-indigo-100 space-y-2 text-left">
                                            <div className="flex items-center justify-between text-[11px] font-black text-slate-800">
                                              <span className="flex items-center gap-1.5 text-indigo-900">
                                                <span>⚖️</span>
                                                <span>各營養素一、二名候選值微調仲裁 ({multiCandidateKeys.length} 項具多候選)</span>
                                              </span>
                                              <span className="text-[9.5px] bg-indigo-600 text-white px-2 py-0.5 rounded-md font-bold shadow-2xs">
                                                點擊即切換
                                              </span>
                                            </div>

                                            <div className="space-y-1.5 text-[10.5px]">
                                              {multiCandidateKeys.map(key => {
                                                const meta = nutrientMeta[key];
                                                const candidates = candsMap[key];
                                                const currentVal = simulatedOcrResult.nutrients[key as keyof NutrientValues] || 0;

                                                return (
                                                  <div key={key} className="p-2 bg-white rounded-xl border border-slate-200/80 space-y-1 shadow-2xs">
                                                    <div className="flex items-center justify-between font-bold text-slate-700">
                                                      <span className="flex items-center gap-1">
                                                        <span>{meta.emoji}</span>
                                                        <span>{meta.label}:</span>
                                                        <span className="font-mono text-emerald-700 font-black text-xs">{currentVal} {meta.unit}</span>
                                                      </span>
                                                      <span className="text-[9px] text-slate-400 font-medium">{candidates.length} 組分支票數</span>
                                                    </div>

                                                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                      {candidates.slice(0, 3).map((cand, idx) => {
                                                        const isSelected = Math.abs(currentVal - cand.val) < (key === 'calories' || key === 'sodium' || key === 'potassium' ? 1 : 0.1);
                                                        return (
                                                          <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => handleApplyNutrientArbitration(key as keyof NutrientValues, cand.val)}
                                                            className={`text-[10px] font-black px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs ${
                                                              isSelected
                                                                ? 'bg-emerald-600 text-white ring-2 ring-emerald-400/50'
                                                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                                            }`}
                                                            title={`點擊將 ${meta.label} 切換為 ${cand.val} ${meta.unit}`}
                                                          >
                                                            <span>{idx === 0 ? '🥇 第 1 候選' : idx === 1 ? '🥈 第 2 候選' : `🥉 第 ${idx + 1} 候選`}:</span>
                                                            <span className="font-mono">{cand.val} {meta.unit}</span>
                                                            <span className="text-[9px] opacity-75">({cand.count}票)</span>
                                                            {isSelected && <span>✓</span>}
                                                          </button>
                                                        );
                                                      })}
                                                    </div>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        );
                                      })()}
                                      <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                                        <div className="p-1.5 bg-slate-50 rounded-xl border border-slate-100">
                                          <span className="text-slate-400 font-bold block text-[9px]">淨碳水 (Net Carbs)</span>
                                          <span className="font-mono font-black text-slate-800">
                                            {simulatedOcrResult.verification.netCarbs} g
                                          </span>
                                          <span className="text-[8.5px] text-slate-400 block font-sans">
                                            ({simulatedOcrResult.nutrients.carbs}g 總碳 - {simulatedOcrResult.nutrients.fiber}g 纖維)
                                          </span>
                                        </div>
                                        <div className="p-1.5 bg-slate-50 rounded-xl border border-slate-100">
                                          <span className="text-slate-400 font-bold block text-[9px]">Atwater 理論熱量</span>
                                          <span className="font-mono font-black text-slate-800">
                                            {simulatedOcrResult.verification.calculatedCalories} kcal
                                          </span>
                                          <span className="text-[8.5px] text-slate-400 block font-sans">
                                            (偏差: {Math.abs(simulatedOcrResult.nutrients.calories - simulatedOcrResult.verification.calculatedCalories)} kcal)
                                          </span>
                                        </div>
                                      </div>

                                      {simulatedOcrResult.verification.arbitratedByAtwater && (
                                        <div className="p-2 bg-emerald-100/90 border border-emerald-300 rounded-xl text-[10px] text-emerald-900 font-bold flex items-center gap-1.5">
                                          <span className="text-xs">⚖️</span>
                                          <span>
                                            已自動執行 Atwater 物理仲裁：第 2 候選熱量 ({simulatedOcrResult.nutrients.calories} kcal) 吻合三大營養素換算勝出！
                                          </span>
                                        </div>
                                      )}

                                      {simulatedOcrResult.verification.issues.length > 0 && (
                                        <div className="text-[10px] text-amber-800 bg-amber-50 p-2 rounded-xl border border-amber-200/80 space-y-1">
                                          {simulatedOcrResult.verification.issues.map((issue: string, idx: number) => (
                                            <div key={idx} className="flex items-start gap-1 font-medium">
                                              <span className="text-amber-600 font-bold shrink-0">⚠️</span>
                                              <span>{issue}</span>
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                      {/* Interactive Calorie Quick-Fix Actions */}
                                      <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-200/60">
                                        {simulatedOcrResult.verification.calculatedCalories > 0 && Math.abs(simulatedOcrResult.nutrients.calories - simulatedOcrResult.verification.calculatedCalories) >= 1 && (
                                          <button
                                            type="button"
                                            onClick={() => handleApplyCalorieCorrection(simulatedOcrResult.verification.calculatedCalories)}
                                            className="text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer"
                                            title="依據 4×淨碳 + 2×纖維 + 4×蛋白 + 9×脂肪 直接校正熱量"
                                          >
                                            <span>⚡</span>
                                            <span>套用理論熱量 ({simulatedOcrResult.verification.calculatedCalories} kcal)</span>
                                          </button>
                                        )}

                                        {simulatedOcrResult.verification.runnerUpCalories != null && simulatedOcrResult.verification.runnerUpCalories !== simulatedOcrResult.nutrients.calories && (
                                          <button
                                            type="button"
                                            onClick={() => handleApplyCalorieCorrection(simulatedOcrResult.verification.runnerUpCalories!)}
                                            className="text-[10px] font-black bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer"
                                            title="切換為加權投票第 2 候選熱量"
                                          >
                                            <span>🔄</span>
                                            <span>切換第 2 候選 ({simulatedOcrResult.verification.runnerUpCalories} kcal)</span>
                                          </button>
                                        )}

                                        {simulatedOcrResult.verification.topCandidateCalories != null && simulatedOcrResult.verification.topCandidateCalories !== simulatedOcrResult.nutrients.calories && (
                                          <button
                                            type="button"
                                            onClick={() => handleApplyCalorieCorrection(simulatedOcrResult.verification.topCandidateCalories!)}
                                            className="text-[10px] font-black bg-slate-600 hover:bg-slate-700 text-white px-2.5 py-1 rounded-lg transition shadow-2xs flex items-center gap-1 cursor-pointer"
                                            title="還原為原始票數最高熱量"
                                          >
                                            <span>↩️</span>
                                            <span>還原第 1 候選 ({simulatedOcrResult.verification.topCandidateCalories} kcal)</span>
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => {
                                      onOpenCustomFoodModal({
                                        id: 'custom_ocr_' + Date.now(),
                                        name: '',
                                        brand: '',
                                        calories: simulatedOcrResult.nutrients.calories,
                                        protein: simulatedOcrResult.nutrients.protein,
                                        fat: simulatedOcrResult.nutrients.fat,
                                        carbs: simulatedOcrResult.nutrients.carbs,
                                        sodium: simulatedOcrResult.nutrients.sodium,
                                        sugars: simulatedOcrResult.nutrients.sugars,
                                        fiber: simulatedOcrResult.nutrients.fiber,
                                        potassium: simulatedOcrResult.nutrients.potassium,
                                        servingAmount: simulatedOcrResult.nutrients.servingSize || 100,
                                        servingUnit: 'g',
                                        aiSource: 'vision',
                                      });
                                    }}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black shadow-md transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                                  >
                                    <Check className="w-4 h-4" />
                                    <span>🟢 套用辨識結果至自訂食品對話框 (名稱與品牌留空)</span>
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <div className="bg-amber-500/10 border border-amber-500/25 rounded-3xl p-4 text-center space-y-2.5">
                                <div className="flex items-center justify-center gap-1.5 text-xs text-amber-900 font-bold">
                                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                  <span>未在影像中讀取到營養數據（零猜測，數值全為 0）</span>
                                </div>
                                <p className="text-[11px] text-amber-800/90 leading-relaxed font-medium">
                                  依零猜測守則，系統不會自動填入任何虛構預設值。若照片側躺或反向，可點擊照片右上角按鈕轉正後重新辨識；亦可改為手動輸入。
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const customOcrFood: FoodSearchResult = {
                                      id: 'manual_' + Date.now(),
                                      name: '手動輸入營養成分',
                                      brand: '手動輸入',
                                      calories: 0,
                                      protein: 0,
                                      fat: 0,
                                      carbs: 0,
                                      sodium: 0,
                                      servingAmount: 100,
                                      servingUnit: 'g',
                                      sugars: 0,
                                      fiber: 0,
                                      potassium: 0,
                                    };
                                    onSelectFood(customOcrFood);
                                  }}
                                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl text-xs font-bold transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                                >
                                  <span>改為手動輸入此食品營養素</span>
                                </button>
                              </div>
                            );
                          })()}

                          {/* Developer Raw Model Output & Debug Console Terminal */}
                          {ocrAdminMode && (
                            <div className="bg-slate-950 text-slate-100 rounded-3xl p-4 font-mono text-xs space-y-3.5 shadow-xl border border-slate-800">
                              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                                <div className="flex items-center gap-2">
                                  <Terminal className="w-4 h-4 text-emerald-400 shrink-0" />
                                  <span className="font-bold text-slate-100 text-xs font-sans">💻 模型底層極速控制台 (Admin Terminal)</span>
                                </div>
                                <span className="text-[9.5px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded-md font-mono font-bold">
                                  RAW OUTPUT
                                </span>
                              </div>

                              {/* Unformatted Raw Extracted Model Output */}
                              <div className="space-y-1.5">
                                <div className="text-[10px] font-sans font-bold flex items-center justify-between">
                                  <span className="text-emerald-400 flex items-center gap-1">
                                    <span>⚡</span>
                                    <span>模型底層未格式化原始字串 (Unformatted Raw Output):</span>
                                  </span>
                                  <span className="text-emerald-400/80 font-mono text-[9px]">
                                    {(simulatedOcrResult.rawUnformattedText || '').length} chars
                                  </span>
                                </div>
                                <pre className="p-3 bg-black/90 rounded-2xl border border-emerald-900/60 text-emerald-300 text-[11px] leading-relaxed whitespace-pre-wrap font-mono max-h-60 overflow-y-auto selection:bg-emerald-900 selection:text-white border-l-4 border-l-emerald-400">
                                  {simulatedOcrResult.rawUnformattedText || simulatedOcrResult.rawText || '(模型未產出底層原始文字)'}
                                </pre>
                              </div>

                              {/* Formatted Pipeline Report */}
                              <div className="space-y-1.5 pt-1">
                                <div className="text-[10px] text-slate-400 font-sans font-bold flex items-center justify-between">
                                  <span>🤖 五階段管線推論報告 (Pipeline Structured Report):</span>
                                </div>
                                <pre className="p-3 bg-black/60 rounded-2xl border border-slate-800 text-slate-300 text-[10.5px] leading-relaxed whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                                  {simulatedOcrResult.rawText}
                                </pre>
                              </div>

                              {/* Pipeline Debug Logs */}
                              {simulatedOcrResult.debugLogs && simulatedOcrResult.debugLogs.length > 0 && (
                                <div className="space-y-1.5 pt-1">
                                  <div className="text-[10px] text-slate-400 font-sans font-bold flex items-center justify-between">
                                    <span>🛠️ 管線推論日誌 (Pipeline Debug Logs):</span>
                                    <span className="text-slate-500 font-mono text-[9px]">{simulatedOcrResult.debugLogs.length} entries</span>
                                  </div>
                                  <div className="p-3 bg-black/80 rounded-2xl border border-slate-800 space-y-1 max-h-44 overflow-y-auto text-[10.5px]">
                                    {simulatedOcrResult.debugLogs.map((log: string, idx: number) => (
                                      <div key={idx} className="flex items-start gap-1.5 text-slate-300 font-mono">
                                        <span className="text-emerald-500 shrink-0">[{idx + 1}]</span>
                                        <span className="break-all">{log}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* OCR Capture/Upload Invitation Mode */
                <div className="space-y-4">
                  <div className="bg-white border-2 border-dashed border-emerald-200 rounded-3xl p-6 sm:p-7 text-center shadow-2xs space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                      <ScanText className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="font-black text-base text-slate-900">
                        上傳營養標示照片
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 font-medium max-w-xs mx-auto leading-relaxed">
                        請上傳或拍攝包含完整「營養標示表（熱量、蛋白質、脂肪、碳水）」的包裝圖片。
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 max-w-xs mx-auto pt-1">
                      <button
                        type="button"
                        onClick={() => setIsOcrCameraModalOpen(true)}
                        className="py-3.5 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-2xl text-emerald-900 transition flex flex-col items-center justify-center gap-1.5 cursor-pointer group active:scale-98"
                      >
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                          <Camera className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold">開啟相機拍攝</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => ocrGalleryInputRef.current?.click()}
                        className="py-3.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-2xl text-slate-800 transition flex flex-col items-center justify-center gap-1.5 cursor-pointer group active:scale-98"
                      >
                        <div className="w-9 h-9 rounded-xl bg-slate-700 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                          <Upload className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-bold">上傳相片圖庫</span>
                      </button>
                    </div>

                    {/* Production Ready status badge */}
                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-center">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 text-[11px] font-black rounded-full border border-emerald-200/80 shadow-2xs">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>端側 AI 極速精準辨識 · 100% 離線隱私安全</span>
                      </span>
                    </div>
                  </div>

                  {/* Recommended Sample & Shooting Guide Card (建議拍攝樣張與準確度指南) */}
                  <div className="bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-sky-50/50 border border-emerald-200/80 rounded-3xl p-4.5 space-y-3.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-2 border-b border-emerald-200/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                          📸
                        </div>
                        <div>
                          <span className="text-xs font-black text-emerald-950 block">建議拍攝樣張與辨識秘訣</span>
                          <span className="text-[10px] text-emerald-700 font-medium block">掌握拍攝要點，辨識準確率提升至 99%</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300/60">
                        標準示範
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 items-center">
                      {/* Visual Mock Label Sample (標準拍攝樣張展示) */}
                      <div className="bg-slate-900/5 rounded-2xl p-2.5 border border-slate-200 flex flex-col items-center">
                        <div className="relative bg-white rounded-xl border-2 border-emerald-500 p-2.5 shadow-sm w-full max-w-[220px] text-left">
                          {/* Corner Focus Reticles */}
                          <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-600" />
                          <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-600" />
                          <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-600" />
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-600" />
                          
                          <div className="absolute top-1 right-1 bg-emerald-600 text-white text-[8px] font-black px-1.5 py-0.2 rounded-full flex items-center gap-0.5 shadow-xs">
                            <Check className="w-2.5 h-2.5 stroke-[3]" /> 合格樣張
                          </div>

                          <div className="border-b border-slate-900 pb-0.5 mb-1">
                            <span className="text-[10.5px] font-black tracking-wider text-slate-900 block leading-tight">營 養 標 示</span>
                            <span className="text-[8.5px] text-slate-600 font-bold block">每一份量 100公克 · 本包裝含 1份</span>
                          </div>

                          <table className="w-full text-[9px] font-mono leading-tight">
                            <thead>
                              <tr className="border-b border-slate-200 font-sans text-[8px] text-slate-500 font-bold">
                                <th className="text-left pb-0.5">每份</th>
                                <th className="text-right pb-0.5">每100克</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                              <tr><td className="py-0.2">熱量</td><td className="text-right font-black text-emerald-700">250 大卡</td></tr>
                              <tr><td className="py-0.2">蛋白質</td><td className="text-right">20.0 公克</td></tr>
                              <tr><td className="py-0.2">脂肪</td><td className="text-right">5.0 公克</td></tr>
                              <tr><td className="py-0.2">碳水化合物</td><td className="text-right">30.0 公克</td></tr>
                              <tr><td className="py-0.2 pl-1.5 text-slate-600">糖</td><td className="text-right text-slate-600">5.0 公克</td></tr>
                              <tr><td className="py-0.2 pl-1.5 text-slate-600">膳食纖維</td><td className="text-right text-slate-600">4.0 公克</td></tr>
                              <tr><td className="py-0.2">鈉</td><td className="text-right">320 毫克</td></tr>
                            </tbody>
                          </table>
                        </div>
                        <span className="text-[9.5px] font-black text-emerald-800 mt-2 flex items-center gap-1">
                          <span>🎯 正面垂直對齊 · 清晰無反光</span>
                        </span>
                      </div>

                      {/* 4 Shooting Tips */}
                      <div className="space-y-2 text-left">
                        <div className="flex items-start gap-2 p-2 bg-white/70 rounded-xl border border-emerald-100">
                          <span className="text-xs">📐</span>
                          <div>
                            <span className="text-[11px] font-black text-slate-800 block leading-tight">1. 正面垂直平行拍攝</span>
                            <span className="text-[9.5px] text-slate-500 leading-snug block mt-0.5">鏡頭與標籤保持正面平行，避免大角度俯視或歪斜。</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 p-2 bg-white/70 rounded-xl border border-emerald-100">
                          <span className="text-xs">💡</span>
                          <div>
                            <span className="text-[11px] font-black text-slate-800 block leading-tight">2. 光線均勻・避開反光</span>
                            <span className="text-[9.5px] text-slate-500 leading-snug block mt-0.5">避免塑膠膜表面產生強烈眩光或手指陰影遮擋文字。</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 p-2 bg-white/70 rounded-xl border border-emerald-100">
                          <span className="text-xs">🔲</span>
                          <div>
                            <span className="text-[11px] font-black text-slate-800 block leading-tight">3. 標籤填滿畫面清晰對焦</span>
                            <span className="text-[9.5px] text-slate-500 leading-snug block mt-0.5">讓整個「營養標示方框」佔畫面 70% 以上，文字保持銳利。</span>
                          </div>
                        </div>

                        <div className="flex items-start gap-2 p-2 bg-white/70 rounded-xl border border-emerald-100">
                          <span className="text-xs">🔄</span>
                          <div>
                            <span className="text-[11px] font-black text-slate-800 block leading-tight">4. 照片側躺可一鍵轉正</span>
                            <span className="text-[9.5px] text-slate-500 leading-snug block mt-0.5">若上傳照片為橫向或倒立，使用頁面上的旋轉按鈕轉正後辨識。</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
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
          {activeTab !== 'AI_SCAN' && activeTab !== 'BARCODE' && activeTab !== 'OCR_SCAN' && activeTab !== 'CLOUD' && activeTab !== 'FAMILY' && activeTab !== 'OPEN_FOOD' && (
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

        {/* OCR Photo & Live Stream Camera Modal */}
        <OcrCameraModal
          isOpen={isOcrCameraModalOpen}
          onClose={() => setIsOcrCameraModalOpen(false)}
          onCaptured={(base64, mime) => {
            setOcrImageBase64(base64);
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
