import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';

export interface OcrPipelineConfig {
  selectedPreprocessing: string[];
  selectedLocator: string;
  selectedExtractors: string[];
  selectedSemantics: string[];
  ensembleStrategy: 'weighted_voting' | 'complementary_fill';
  updatedAt?: number;
  updatedBy?: string;
  version?: number;
}

export const DEFAULT_OCR_PIPELINE_CONFIG: OcrPipelineConfig = {
  selectedPreprocessing: ['auto_orientation_osd', 'sauvola_adaptive', 'digit_stroke_repair'],
  selectedLocator: 'yolov8_doc',
  selectedExtractors: ['pp_ocrv4'],
  selectedSemantics: ['regex_table', 'fuzzy_levenshtein'],
  ensembleStrategy: 'complementary_fill',
  version: 1,
};

const OCR_CONFIG_DOC_PATH = 'system_config';
const OCR_CONFIG_DOC_ID = 'ocr_pipeline';
const LOCAL_STORAGE_KEY = 'fitpocket_ocr_pipeline_cloud_config';

/**
 * Loads the active OCR Pipeline configuration.
 * Priority: Firestore Cloud Config -> LocalStorage Cached Config -> Default Preset
 */
export async function getOcrPipelineConfig(): Promise<OcrPipelineConfig> {
  try {
    const docRef = doc(db, OCR_CONFIG_DOC_PATH, OCR_CONFIG_DOC_ID);
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data() as Partial<OcrPipelineConfig>;
      const mergedConfig: OcrPipelineConfig = {
        selectedPreprocessing: Array.isArray(data.selectedPreprocessing) && data.selectedPreprocessing.length > 0
          ? data.selectedPreprocessing
          : DEFAULT_OCR_PIPELINE_CONFIG.selectedPreprocessing,
        selectedLocator: typeof data.selectedLocator === 'string' && data.selectedLocator
          ? data.selectedLocator
          : DEFAULT_OCR_PIPELINE_CONFIG.selectedLocator,
        selectedExtractors: Array.isArray(data.selectedExtractors) && data.selectedExtractors.length > 0
          ? data.selectedExtractors
          : DEFAULT_OCR_PIPELINE_CONFIG.selectedExtractors,
        selectedSemantics: Array.isArray(data.selectedSemantics) && data.selectedSemantics.length > 0
          ? data.selectedSemantics
          : DEFAULT_OCR_PIPELINE_CONFIG.selectedSemantics,
        ensembleStrategy: data.ensembleStrategy === 'weighted_voting' || data.ensembleStrategy === 'complementary_fill'
          ? data.ensembleStrategy
          : DEFAULT_OCR_PIPELINE_CONFIG.ensembleStrategy,
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
        version: data.version || 1,
      };

      // Cache locally for offline availability
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(mergedConfig));
      } catch (storageErr) {
        console.warn('LocalStorage save error:', storageErr);
      }

      return mergedConfig;
    }
  } catch (err) {
    console.warn('Failed to fetch OCR pipeline config from Firestore, using local cache fallback:', err);
  }

  // Fallback to localStorage
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_OCR_PIPELINE_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('Error reading OCR config from localStorage:', e);
  }

  return DEFAULT_OCR_PIPELINE_CONFIG;
}

/**
 * Saves the finalized OCR Pipeline configuration to Firestore.
 * Write access is strictly restricted by Firestore rules to the Developer account.
 */
export async function saveOcrPipelineConfig(config: Partial<OcrPipelineConfig>): Promise<{ success: boolean; message: string }> {
  const currentEmail = (auth.currentUser?.email || '').toLowerCase();
  if (currentEmail !== 'kevin10611@gmail.com') {
    return {
      success: false,
      message: '權限不足：僅有認證的系統開發者 (Kevin10611@gmail.com) 具有修改發布全域 OCR 模型配置的權限。',
    };
  }

  const payload: OcrPipelineConfig = {
    selectedPreprocessing: config.selectedPreprocessing || DEFAULT_OCR_PIPELINE_CONFIG.selectedPreprocessing,
    selectedLocator: config.selectedLocator || DEFAULT_OCR_PIPELINE_CONFIG.selectedLocator,
    selectedExtractors: config.selectedExtractors || DEFAULT_OCR_PIPELINE_CONFIG.selectedExtractors,
    selectedSemantics: config.selectedSemantics || DEFAULT_OCR_PIPELINE_CONFIG.selectedSemantics,
    ensembleStrategy: config.ensembleStrategy || DEFAULT_OCR_PIPELINE_CONFIG.ensembleStrategy,
    updatedAt: Date.now(),
    updatedBy: auth.currentUser?.email || 'Kevin10611@gmail.com',
    version: (config.version || 1) + 1,
  };

  try {
    const docRef = doc(db, OCR_CONFIG_DOC_PATH, OCR_CONFIG_DOC_ID);
    await setDoc(docRef, payload, { merge: true });

    // Update local cache
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload));
      localStorage.setItem('ocr_selected_preprocessing', JSON.stringify(payload.selectedPreprocessing));
      localStorage.setItem('ocr_selected_locator', payload.selectedLocator);
      localStorage.setItem('ocr_selected_extractors', JSON.stringify(payload.selectedExtractors));
      localStorage.setItem('ocr_selected_semantics', JSON.stringify(payload.selectedSemantics));
      localStorage.setItem('ocr_ensemble_strategy', payload.ensembleStrategy);
    } catch (e) {
      console.warn('Local storage sync notice:', e);
    }

    return {
      success: true,
      message: `成功將最新五階段 OCR 模型配置（版本 v${payload.version}）發布並同步至 Firebase 雲端資料庫！所有使用者將自動套用此設定。`,
    };
  } catch (error: any) {
    handleFirestoreError(error, OperationType.WRITE, `${OCR_CONFIG_DOC_PATH}/${OCR_CONFIG_DOC_ID}`);
    return {
      success: false,
      message: error?.message || '儲存至 Firebase 失敗',
    };
  }
}
