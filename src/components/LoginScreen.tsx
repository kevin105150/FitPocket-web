import React, { useState } from 'react';
import { motion } from 'motion/react';
import { LogIn, Sparkles, Smartphone, CheckCircle2, AlertCircle } from 'lucide-react';
import { loginWithGoogle } from '../lib/firebase';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const result = await loginWithGoogle();
      if (result && result.isRedirecting) {
        // Mobile is redirecting to Google, do not call reload/onLoginSuccess
        return;
      }
      onLoginSuccess();
    } catch (error: any) {
      console.error('Login failed:', error);
      
      if (error?.code === 'auth/popup-closed-by-user') {
        setErrorMsg('登入視窗已關閉，請再試一次。');
      } else if (error?.code === 'auth/popup-blocked') {
        setErrorMsg('登入彈窗被瀏覽器攔截，請允許此網頁顯示彈窗後再試。');
      } else if (error?.code === 'auth/network-request-failed') {
        setErrorMsg('網路連接失敗，請檢查您的網路狀態。');
      } else {
        setErrorMsg('登入過程中發生預料之外的錯誤，請稍後再試。');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-emerald-100/50 rounded-full blur-3xl" />
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-sky-100/50 rounded-full blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[40px] shadow-2xl border border-slate-200/50 p-8 sm:p-12 relative z-10 text-center"
      >
        {/* App Logo */}
        <div className="w-20 h-20 bg-emerald-800 rounded-[28px] text-white flex items-center justify-center font-black text-3xl shadow-xl mx-auto mb-8">
          FP
        </div>

        <h1 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">
          FitPocket
        </h1>
        <p className="text-slate-500 text-sm font-medium mb-10">
          您的 AI 飲食與健身私人管家
        </p>

        {/* Feature List */}
        <div className="space-y-4 mb-10 text-left">
          {[
            { icon: Sparkles, text: 'AI 拍照辨識與飲食精準分析', color: 'text-purple-600', bg: 'bg-purple-50' },
            { icon: CheckCircle2, text: '跨裝置雲端同步您的健康紀錄', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { icon: Smartphone, text: '支援 Android 原生 APK 離線使用', color: 'text-sky-600', bg: 'bg-sky-50' },
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl ${feature.bg} flex items-center justify-center flex-shrink-0`}>
                <feature.icon className={`w-4 h-4 ${feature.color}`} />
              </div>
              <span className="text-xs font-bold text-slate-700">{feature.text}</span>
            </div>
          ))}
        </div>

        {/* Error Message */}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-left"
          >
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
            <span className="text-[11px] font-bold text-rose-600 leading-tight">
              {errorMsg}
            </span>
          </motion.div>
        )}

        {/* Login Button */}
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-3xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg disabled:opacity-50 disabled:pointer-events-none group"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 group-hover:scale-110 transition" />
              <span>使用 Google 帳號開始使用</span>
            </>
          )}
        </button>

        <p className="mt-8 text-[10px] text-slate-400 font-medium leading-relaxed">
          登入即代表您同意我們的服務條款與隱私權政策。<br />
          系統將自動同步您的飲食與訓練數據。
        </p>
      </motion.div>

      {/* Footer Branding */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-12 text-center"
      >
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
          Powered by Gemini AI Intelligence
        </span>
      </motion.div>
    </div>
  );
};
