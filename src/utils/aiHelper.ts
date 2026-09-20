import { StorageService } from '../services/storage';
import { auth } from '../lib/firebase';

export const checkAiKeyOrWarn = (): boolean => {
  const source = StorageService.getAiKeySource();
  const customKey = StorageService.getGeminiApiKey();

  if (source === 'custom') {
    if (!customKey || !customKey.trim()) {
      alert('【尚未設定個人 AI API Key】\n\n您目前選擇使用「個人 API 金鑰」，請至「設定」頁面輸入您的 Gemini API Key，或切換為「開發者共享金鑰」。');
      return false;
    }
    return true;
  }

  // Developer mode
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.email) {
    alert('【需要登入 Google 帳號】\n\n您目前選擇使用「開發者共享 AI 金鑰」，請先登入 Google 帳號以核對白名單權限。');
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
    customApiKey: source === 'custom' ? customKey : undefined,
    userEmail: currentUser?.email || '',
    userUid: currentUser?.uid || '',
  };
};

