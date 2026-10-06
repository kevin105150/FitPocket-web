import { StorageService } from '../services/storage';
import { auth } from '../lib/firebase';

export const checkAiKeyOrWarn = (): boolean => {
  const source = StorageService.getAiKeySource();
  const customKey = StorageService.getGeminiApiKey();

  if (source === 'custom' && customKey && customKey.trim()) {
    return true;
  }

  // Developer mode or no valid custom key set
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.email) {
    alert('【需要登入 Google 帳號】\n\n您目前使用「開發者共享 AI 金鑰」，請先登入 Google 帳號以核對白名單權限。');
    return false;
  }

  return true;
};

export const getAiRequestParams = () => {
  const source = StorageService.getAiKeySource();
  const customKey = StorageService.getGeminiApiKey();
  const currentUser = auth.currentUser;

  return {
    apiKeySource: source,
    customApiKey: (source === 'custom' && customKey && customKey.trim()) ? customKey.trim() : undefined,
    userEmail: currentUser?.email || '',
    userUid: currentUser?.uid || '',
  };
};

export const ALLOWED_3X_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
];

// 取得以使用者偏好模型為第一首發，並依序循環剩餘 3.x 模型的清單
export const getOrdered3xModels = (preferredModel?: string): string[] => {
  const targetModel = preferredModel && ALLOWED_3X_MODELS.includes(preferredModel)
    ? preferredModel
    : 'gemini-3.8-flash';
  const startIndex = ALLOWED_3X_MODELS.indexOf(targetModel);

  const ordered: string[] = [];
  for (let i = 0; i < ALLOWED_3X_MODELS.length; i++) {
    const idx = (startIndex + i) % ALLOWED_3X_MODELS.length;
    ordered.push(ALLOWED_3X_MODELS[idx]);
  }
  return ordered;
};

