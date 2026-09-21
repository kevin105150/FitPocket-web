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

