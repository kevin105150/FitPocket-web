import { StorageService } from '../services/storage';

export const checkAiKeyOrWarn = (): boolean => {
  const key = StorageService.getGeminiApiKey();
  if (!key || !key.trim()) {
    alert('【尚未設定 AI API Key】\n\n請先至「設定」頁面輸入您的 Gemini AI API Key 才能使用 AI 相關功能！');
    return false;
  }
  return true;
};
