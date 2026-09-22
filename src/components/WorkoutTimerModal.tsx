import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, RotateCcw, Volume2, Bell, Clock } from 'lucide-react';
import { StorageService } from '../services/storage';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

interface WorkoutTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WorkoutTimerModal: React.FC<WorkoutTimerModalProps> = ({ isOpen, onClose }) => {
  useModalBackHandler(isOpen, onClose);

  const [mode, setMode] = useState<'TIMER' | 'STOPWATCH'>('TIMER');
  const [timerDuration, setTimerDuration] = useState<number>(60);
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [timerPresets, setTimerPresets] = useState<number[]>(StorageService.getTimerPresets());
  const [newPreset, setNewPreset] = useState<string>('');

  // Stopwatch state
  const [stopwatchSeconds, setStopwatchSeconds] = useState<number>(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState<boolean>(false);

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Web Audio synth beep
  const playBeep = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn('Audio beep error:', e);
    }
  };

  // Timer countdown effect
  useEffect(() => {
    let interval: any = null;
    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            playBeep();
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, timeLeft]);

  // Stopwatch effect
  useEffect(() => {
    let interval: any = null;
    if (isStopwatchRunning) {
      interval = setInterval(() => {
        setStopwatchSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isStopwatchRunning]);

  if (!isOpen) return null;

  const handleSetPreset = (sec: number) => {
    setTimerDuration(sec);
    setTimeLeft(sec);
    setIsRunning(true);
  };

  const handleAddPreset = () => {
    const val = parseInt(newPreset);
    if (!isNaN(val) && val > 0 && !timerPresets.includes(val)) {
      const updated = [...timerPresets, val].sort((a, b) => a - b);
      setTimerPresets(updated);
      StorageService.saveTimerPresets(updated);
      setNewPreset('');
    }
  };

  const handleDeletePreset = (sec: number) => {
    const updated = timerPresets.filter(p => p !== sec);
    setTimerPresets(updated);
    StorageService.saveTimerPresets(updated);
  };

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent =
    timerDuration > 0 ? Math.round(((timerDuration - timeLeft) / timerDuration) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col p-6 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-sky-600" />
            <h3 className="font-bold text-slate-900 text-base">訓練組間休息碼錶</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-2xl my-4">
          <button
            onClick={() => setMode('TIMER')}
            className={`py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
              mode === 'TIMER'
                ? 'bg-white text-sky-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            組間倒數計時
          </button>
          <button
            onClick={() => setMode('STOPWATCH')}
            className={`py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
              mode === 'STOPWATCH'
                ? 'bg-white text-sky-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            連續碼錶計時
          </button>
        </div>

        {/* TIMER MODE */}
        {mode === 'TIMER' && (
          <div className="flex flex-col items-center py-2 space-y-5">
            {/* Big Countdown Display */}
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  className="text-slate-100 stroke-current"
                  strokeWidth="8"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  className="text-sky-600 stroke-current transition-all duration-300"
                  strokeWidth="8"
                  strokeDasharray="276"
                  strokeDashoffset={276 - (276 * progressPercent) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-4xl font-black text-slate-900 tracking-tight">
                  {formatTime(timeLeft)}
                </span>
                <span className="text-[11px] font-semibold text-slate-400 mt-1">
                  {timeLeft === 0 ? '休息結束！' : `設定 ${timerDuration}s`}
                </span>
              </div>
            </div>

            {/* Presets + Custom Scroll */}
            <div className="flex flex-col gap-3 w-full">
              <div className="grid grid-cols-4 gap-2">
                {timerPresets.map((sec) => (
                  <div key={sec} className="relative group">
                    <button
                      onClick={() => {
                        handleSetPreset(sec);
                        setTimeLeft(sec);
                      }}
                      className={`w-full py-2 text-xs font-bold rounded-xl border transition cursor-pointer ${
                        timerDuration === sec
                          ? 'bg-sky-50 border-sky-500 text-sky-800'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {sec}s
                    </button>
                    <button
                      onClick={() => handleDeletePreset(sec)}
                      className="absolute -top-1 -right-1 bg-white rounded-full shadow-xs text-slate-400 hover:text-red-500"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 border border-slate-200 rounded-xl p-2 bg-slate-50">
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">新增預設：</span>
                <input
                  type="number"
                  min="1"
                  placeholder="秒"
                  value={newPreset}
                  onChange={(e) => setNewPreset(e.target.value)}
                  className="w-full text-center font-bold text-sm text-slate-900 bg-transparent focus:outline-sky-600 rounded-lg p-1"
                />
                <button
                  onClick={handleAddPreset}
                  className="px-3 py-1 bg-sky-600 text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-sky-700 whitespace-nowrap shrink-0"
                >
                  新增
                </button>
              </div>
              <div className="flex flex-col gap-1 border border-slate-200 rounded-xl p-3 bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">自訂計時：</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={Math.floor(timerDuration / 60)}
                      onChange={(e) => {
                        const mins = Math.max(0, Math.min(60, parseInt(e.target.value) || 0));
                        const secs = timerDuration % 60;
                        const total = mins * 60 + secs;
                        setTimerDuration(total);
                        setTimeLeft(total);
                      }}
                      className="w-10 text-center font-bold text-sm text-slate-900 bg-transparent focus:outline-sky-600 rounded-lg"
                    />
                    <span className="text-xs font-bold text-slate-500">分</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={timerDuration % 60}
                      onChange={(e) => {
                        const mins = Math.floor(timerDuration / 60);
                        const secs = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                        const total = mins * 60 + secs;
                        setTimerDuration(total);
                        setTimeLeft(total);
                      }}
                      className="w-10 text-center font-bold text-sm text-slate-900 bg-transparent focus:outline-sky-600 rounded-lg"
                    />
                    <span className="text-xs font-bold text-slate-500">秒</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="1"
                  max="3600"
                  value={timerDuration}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setTimerDuration(val);
                    setTimeLeft(val);
                  }}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                />
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setTimeLeft(timerDuration);
                  setIsRunning(false);
                }}
                className="p-3 text-slate-500 hover:bg-slate-100 rounded-2xl transition cursor-pointer"
                title="重設"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => setIsRunning(!isRunning)}
                className="w-14 h-14 flex items-center justify-center rounded-2xl bg-sky-600 text-white shadow-md hover:bg-sky-700 active:scale-95 transition cursor-pointer"
              >
                {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>

              <button
                type="button"
                onClick={playBeep}
                className="p-3 text-slate-500 hover:bg-slate-100 rounded-2xl transition cursor-pointer"
                title="測試提示音"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* STOPWATCH MODE */}
        {mode === 'STOPWATCH' && (
          <div className="flex flex-col items-center py-4 space-y-6">
            <div className="text-5xl font-black text-slate-900 tracking-wider font-mono">
              {formatTime(stopwatchSeconds)}
            </div>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setStopwatchSeconds(0);
                  setIsStopwatchRunning(false);
                }}
                className="p-3 text-slate-500 hover:bg-slate-100 rounded-2xl transition cursor-pointer"
                title="歸零"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              {/* Play/Pause buttons */}
              {!isStopwatchRunning ? (
                <button
                  type="button"
                  onClick={() => setIsStopwatchRunning(true)}
                  className="w-14 h-14 flex items-center justify-center rounded-2xl bg-sky-600 text-white shadow-md hover:bg-sky-700 active:scale-95 transition cursor-pointer"
                  title="開始"
                >
                  <Play className="w-6 h-6 ml-0.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsStopwatchRunning(false)}
                  className="w-14 h-14 flex items-center justify-center rounded-2xl bg-amber-600 text-white shadow-md hover:bg-amber-700 active:scale-95 transition cursor-pointer"
                  title="暫停"
                >
                  <Pause className="w-6 h-6" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
