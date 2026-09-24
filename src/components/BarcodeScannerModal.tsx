import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, Image, X, Flashlight, RefreshCw, AlertCircle, Loader2, Sparkles, CheckCircle2, ChevronDown, Check } from 'lucide-react';
import { StorageService } from '../services/storage';
import { getAiRequestParams } from '../utils/aiHelper';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}

/**
 * Rank and format camera device labels to intuitive Chinese names.
 * Prioritizes back cameras and "main" lenses over ultra-wide or front lenses for better barcode focus.
 */
function rankAndFormatCameras<T extends { id?: string; deviceId?: string; label?: string }>(
  devices: T[]
): Array<{ id: string; label: string }> {
  // 1. Identify types and assign base scores
  const scored = devices.map((d, index) => {
    const id = d.id || d.deviceId || String(index);
    const label = (d.label || '').toLowerCase();
    let score = 0;

    const isBack = 
      label.includes('back') || 
      label.includes('rear') || 
      label.includes('environment') || 
      label.includes('後') || 
      label.includes('main');
      
    const isFront = 
      label.includes('front') || 
      label.includes('user') || 
      label.includes('前') || 
      label.includes('selfie') || 
      label.includes('facetime');

    const isUltraWide = label.includes('ultra wide') || label.includes('0.5x') || label.includes('超廣角');
    const isTele = label.includes('tele') || label.includes('遠攝');

    if (isBack) score += 100;
    if (isFront) score -= 100;
    if (label.includes('main') || label.includes('primary')) score += 50;
    if (isUltraWide) score -= 60; // Strongly de-prioritize ultra wide for barcodes
    if (isTele) score -= 10;
    
    // Tie-break by original index (usually primary cameras are earlier in system list)
    score -= index;

    return { 
      id, 
      label: d.label || '', 
      score, 
      isBack, 
      isFront 
    };
  });

  // 2. Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // 3. Format names sequentially for the sorted list
  let backCount = 0;
  let frontCount = 0;

  return scored.map((s) => {
    let formattedName = '';
    if (s.isFront) {
      frontCount++;
      formattedName = `前置鏡頭 ${frontCount}`;
    } else {
      backCount++;
      formattedName = `後置鏡頭 ${backCount}`;
      if (backCount === 1) formattedName += ' (推薦使用)';
    }
    return { id: s.id, label: formattedName };
  });
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onDetected,
}) => {
  const [activeMode, setActiveMode] = useState<'camera' | 'file'>('camera');
  const [isScanning, setIsScanning] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [scanError, setScanError] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [detectedCode, setDetectedCode] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([
    { id: 'environment', label: '後置主鏡頭 (推薦)' },
    { id: 'user', label: '前置鏡頭' },
  ]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isCameraDropdownOpen, setIsCameraDropdownOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const activeRequestIdRef = useRef<number>(0);
  const isStoppingRef = useRef<boolean>(false);

  const handleClose = async () => {
    if (isExiting) return;
    setIsExiting(true);
    await stopCamera();
    onClose();
  };

  useModalBackHandler(isOpen, handleClose);

  useEffect(() => {
    if (!isOpen) return;
    // Body scroll lock
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

  // Synchronize isOpen with shouldRender and handle automatic exit cleanup
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsExiting(false);
    } else if (shouldRender) {
      setIsExiting(true);
      stopCamera();
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 350); // Match or exceed CSS transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close camera dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCameraDropdownOpen(false);
      }
    };
    if (isCameraDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCameraDropdownOpen]);

  // Play audio beep on barcode detection
  const playBeep = () => {
    try {
      if ('vibrate' in navigator) {
        navigator.vibrate([120, 60, 120]);
      }
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1046.5, audioCtx.currentTime); // C6 tone
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.25);
    } catch {
      // AudioContext fallback ignored safely
    }
  };

  const handleSuccess = async (code: string) => {
    const cleanCode = code.trim();
    if (!cleanCode) return;
    setDetectedCode(cleanCode);
    playBeep();

    setIsExiting(true);
    await stopCamera();
    // Allow animation to complete
    await new Promise(r => setTimeout(r, 400));

    onDetected(cleanCode);
    onClose();
  };

  // Start live camera stream scanner
  const startCamera = async (cameraId?: string) => {
    setScanError('');
    setDetectedCode(null);

    await stopCamera(); // Increments activeRequestIdRef.current and stops previous stream cleanly
    const myRequestId = activeRequestIdRef.current;

    try {
      const qrCodeElementId = 'barcode-live-scanner-viewport';
      // Ensure element exists before initializing
      const element = document.getElementById(qrCodeElementId);
      if (!element) {
        if (myRequestId === activeRequestIdRef.current) {
          setScanError('掃描視窗初始化失敗，請重試。');
        }
        return;
      }

      if (!navigator?.mediaDevices?.getUserMedia) {
        if (myRequestId === activeRequestIdRef.current) {
          setScanError('您的瀏覽器不支援 WebRTC 相機連線，請使用「開啟原生系統相機」拍照。');
        }
        return;
      }

      // Pre-request getUserMedia to cleanly prompt and secure first-time permission
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({
          video: cameraId && cameraId !== 'environment' && cameraId !== 'user'
            ? { deviceId: { exact: cameraId } }
            : { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        // Release the test stream immediately so Html5Qrcode can bind the camera
        testStream.getTracks().forEach((track) => {
          try { track.stop(); } catch {}
        });
      } catch (permErr: any) {
        if (myRequestId !== activeRequestIdRef.current) return;
        const errName = permErr?.name || '';
        const errMsg = String(permErr?.message || '');
        
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError' || errMsg.includes('Permission denied')) {
          setScanError('相機存取權限已被拒絕。請在瀏覽器網址列點擊鎖頭/設定圖示開啟相機權限，或使用下方「開啟原生系統相機」。');
          setIsScanning(false);
          return;
        }

        // If exact device ID failed (e.g. overconstrained), fallback test stream
        if (cameraId) {
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
            fallbackStream.getTracks().forEach((track) => { try { track.stop(); } catch {} });
          } catch (fErr: any) {
            if (myRequestId !== activeRequestIdRef.current) return;
            if (fErr?.name === 'NotAllowedError' || fErr?.name === 'PermissionDeniedError') {
              setScanError('相機存取權限已被拒絕。請在瀏覽器設定開啟權限，或使用下方原生相機按鈕。');
              setIsScanning(false);
              return;
            }
          }
        }
      }

      if (myRequestId !== activeRequestIdRef.current) return;

      const html5Qrcode = new Html5Qrcode(qrCodeElementId);
      html5QrcodeRef.current = html5Qrcode;

      const formatsToSupport = [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_128,
      ];

      const config = {
        fps: 20,
        qrbox: (viewWidth: number, viewHeight: number) => {
          const width = Math.floor(viewWidth * 0.8);
          const height = Math.floor(viewHeight * 0.4);
          return { width, height };
        },
        formatsToSupport,
        disableFlip: false,
      };

      const cameraConstraint = cameraId
        ? (cameraId === 'environment' || cameraId === 'user'
            ? { facingMode: cameraId }
            : { deviceId: { exact: cameraId } })
        : { facingMode: 'environment' };

      try {
        await html5Qrcode.start(
          cameraConstraint,
          config,
          (decodedText) => {
            if (myRequestId === activeRequestIdRef.current) {
              handleSuccess(decodedText);
            }
          },
          () => {}
        );
      } catch (startErr) {
        if (myRequestId !== activeRequestIdRef.current) {
          if (html5QrcodeRef.current) {
            try { 
              await html5QrcodeRef.current.stop(); 
              html5QrcodeRef.current.clear(); 
            } catch {}
            html5QrcodeRef.current = null;
          }
          return;
        }
        console.warn('Barcode camera constraint failed, attempting environment fallback:', startErr);
        
        try {
          if (html5QrcodeRef.current) {
            try { await html5QrcodeRef.current.stop(); } catch {}
            try { html5QrcodeRef.current.clear(); } catch {}
            html5QrcodeRef.current = null;
          }
        } catch {}

        const fallbackHtml5Qrcode = new Html5Qrcode(qrCodeElementId);
        html5QrcodeRef.current = fallbackHtml5Qrcode;

        await fallbackHtml5Qrcode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (myRequestId === activeRequestIdRef.current) {
              handleSuccess(decodedText);
            }
          },
          () => {}
        );
      }

      if (myRequestId !== activeRequestIdRef.current) {
        if (html5QrcodeRef.current) {
          try { 
            await html5QrcodeRef.current.stop(); 
            html5QrcodeRef.current.clear(); 
          } catch {}
          html5QrcodeRef.current = null;
        }
        return;
      }

      setIsScanning(true);

      // Query cameras after permission is granted and camera is active to get valid labeled devices
      try {
        const postDevices = await Html5Qrcode.getCameras();
        if (myRequestId === activeRequestIdRef.current && postDevices && postDevices.length > 0) {
          const formatted = rankAndFormatCameras(postDevices);
          setAvailableCameras(formatted);
          if (!cameraId && formatted.length > 0) {
            setSelectedCameraId(formatted[0].id);
          }
        }
      } catch {
        // ignore device enumeration errors if not supported on platform
      }

      // Check torch support
      try {
        const capabilities = html5Qrcode.getRunningTrackCapabilities();
        if (myRequestId === activeRequestIdRef.current) {
          if (capabilities && (capabilities as any).torch) {
            setHasTorch(true);
          } else {
            setHasTorch(false);
          }
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err: any) {
      if (myRequestId !== activeRequestIdRef.current) return;
      console.warn('Camera start error:', err);
      setIsScanning(false);
      setScanError('無法啟用相機鏡頭，請確認已授予網站相機使用權限，或切換至「拍照/上傳圖片」模式。');
    }
  };

  // Stop camera when closing or switching mode
  const stopCamera = async () => {
    activeRequestIdRef.current += 1;

    // 1. Forcefully stop ALL active video/media streams in the document immediately
    // This is the most reliable way to release hardware regardless of library state
    try {
      const allVideos = document.querySelectorAll('video');
      allVideos.forEach(v => {
        if (v.srcObject) {
          try {
            const ms = v.srcObject as MediaStream;
            if (ms && ms.getTracks) {
              ms.getTracks().forEach(t => {
                try { t.stop(); } catch {}
              });
            }
            v.srcObject = null;
            v.load(); // Force reset video element state
          } catch {}
        }
      });
    } catch {}

    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    try {
      if (html5QrcodeRef.current) {
        const instance = html5QrcodeRef.current;
        html5QrcodeRef.current = null;
        
        // Use isScanning check or try-catch for safety
        try {
          // If the library is still in start transition, stop might throw
          // but we've already stopped the tracks above manually
          await instance.stop();
        } catch (stopErr) {
          // It's common for stop() to fail if start() hasn't finished
        }
        
        try {
          instance.clear();
        } catch (clearErr) {}
      }

      // Brief hardware release pause
      await new Promise(r => setTimeout(r, 200));
    } finally {
      isStoppingRef.current = false;
      setIsScanning(false);
      setIsTorchOn(false);
    }
  };

  // Toggle flashlight
  const toggleTorch = async () => {
    if (!html5QrcodeRef.current || !isScanning) return;
    try {
      const nextState = !isTorchOn;
      await html5QrcodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any],
      });
      setIsTorchOn(nextState);
    } catch (e) {
      console.warn('Failed to toggle torch:', e);
    }
  };

  useEffect(() => {
    if (isOpen && activeMode === 'camera') {
      setIsExiting(false);

      const timer = setTimeout(() => {
        startCamera(selectedCameraId);
      }, 300);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      // Ensure camera is stopped if modal is closed or not in camera mode
      stopCamera();
    }
  }, [isOpen, activeMode]);

  // Handle File / Photo image barcode scanning
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setScanError('');
    setDetectedCode(null);

    try {
      // 1. Try html5-qrcode scanFile
      const tempScanner = new Html5Qrcode('temp-barcode-file-decoder');
      try {
        const decodedText = await tempScanner.scanFile(file, false);
        if (decodedText) {
          handleSuccess(decodedText);
          setIsProcessingFile(false);
          try { tempScanner.clear(); } catch {}
          return;
        }
      } catch {
        // html5-qrcode standard decoder didn't find barcode, proceed to native & AI fallback
      } finally {
        try { tempScanner.clear(); } catch {}
      }

      // 2. Try browser native BarcodeDetector API if supported
      if ('BarcodeDetector' in window) {
        try {
          const barcodeDetector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
          });
          const img = document.createElement('img');
          img.src = URL.createObjectURL(file);
          await new Promise((res) => (img.onload = res));
          const barcodes = await barcodeDetector.detect(img);
          if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
            handleSuccess(barcodes[0].rawValue);
            setIsProcessingFile(false);
            return;
          }
        } catch {
          // Native BarcodeDetector fallback ignored
        }
      }

      // 3. Fallback to Gemini AI Vision Barcode Reader
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const base64 = evt.target?.result as string;
        if (!base64) {
          setScanError('無法讀取照片資料');
          setIsProcessingFile(false);
          return;
        }

        try {
          const aiParams = getAiRequestParams();
          const ALLOWED_3X_MODELS = [
            'gemini-3.1-flash-lite',
            'gemini-3.8-flash',
            'gemini-3.6-flash',
            'gemini-3.5-flash',
          ];
          
          let lastResultRes: Response | null = null;
          for (let i = 0; i < ALLOWED_3X_MODELS.length; i++) {
            const currentModel = ALLOWED_3X_MODELS[i];
            try {
              const res = await fetch('/api/ai/read-barcode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  imageBase64: base64,
                  mimeType: file.type || 'image/jpeg',
                  customApiKey: aiParams.customApiKey,
                  apiKeySource: aiParams.apiKeySource,
                  userEmail: aiParams.userEmail,
                  userUid: aiParams.userUid,
                  model: currentModel,
                  disableFallback: true
                }),
              });

              if (res.ok) {
                lastResultRes = res;
                break;
              }

              // Robust transient error detection
              const errData = await res.json().catch(() => ({}));
              const errStatus = res.status;
              const errMsg = String(errData.error || '');
              const isTransient = errStatus === 503 || errStatus === 429 || 
                                 errMsg.includes('503') || errMsg.includes('429') || 
                                 errMsg.includes('high demand') || errMsg.includes('Busy') ||
                                 errMsg.includes('RESOURCE_EXHAUSTED');

              if (isTransient) {
                console.warn(`[Barcode Fallback] ${currentModel} returned transient error (${errStatus}), trying next...`);
                continue;
              }
              
              throw new Error(errMsg || '條碼分析失敗');
            } catch (err: any) {
              if (i === ALLOWED_3X_MODELS.length - 1) throw err;
              const errMsg = String(err.message || '');
              if (errMsg.includes('Busy') || errMsg.includes('503') || errMsg.includes('429') || errMsg.includes('high demand')) {
                 continue;
              }
              continue;
            }
          }

          if (lastResultRes && lastResultRes.ok) {
            const data = await lastResultRes.json();
            if (data._usage) {
              StorageService.recordApiUsage(data._usage);
            }
            if (data.barcode) {
              handleSuccess(data.barcode);
              setIsProcessingFile(false);
              return;
            }
          }
          setScanError('相片中未偵測到清晰的條碼，請調整角度拍攝包裝上的國際條碼（13碼數字）。');
        } catch (err: any) {
          const errMsg = String(err?.message || '');
          if (errMsg.includes('忙碌') || errMsg.includes('503') || errMsg.includes('429')) {
            setScanError('AI 伺服器忙碌中，請稍後重試');
          } else {
            setScanError(errMsg || '條碼分析失敗，請重試或改用語音/文字搜尋。');
          }
        } finally {
          setIsProcessingFile(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setScanError('處理照片失敗，請重試');
      setIsProcessingFile(false);
    }
  };

  if (!shouldRender) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md transition-opacity duration-300 ${isExiting ? 'opacity-0 pointer-events-none' : 'animate-in fade-in'}`}>
      {/* Hidden div for html5-qrcode file decoder */}
      <div id="temp-barcode-file-decoder" className="hidden" />

      <div className={`bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 flex flex-col h-[82vh] sm:h-[75vh] max-h-[640px] transition-all duration-300 ${isExiting ? 'scale-95 translate-y-10' : 'scale-100'}`}>
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-400">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide">鏡頭掃描條碼</h3>
              <p className="text-[10px] text-slate-400">對準食品外包裝條碼，自動連線資料庫</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isExiting}
            className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="p-2 bg-slate-100 border-b border-slate-200 flex gap-1 shrink-0">
          <button
            onClick={() => setActiveMode('camera')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMode === 'camera'
                ? 'bg-white text-blue-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            即時相機掃描
          </button>
          <button
            onClick={() => setActiveMode('file')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMode === 'file'
                ? 'bg-white text-blue-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Image className="w-3.5 h-3.5" />
            拍照 / 上傳圖片
          </button>
        </div>

        {/* Main Content Area */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {/* Always rendered hidden file inputs so refs remain valid in any mode */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <input
            ref={nativeCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* CAMERA MODE */}
          {activeMode === 'camera' && (
            <div className="space-y-3">
              {/* Scanner Container */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-[4/3] border border-slate-800 shadow-inner flex items-center justify-center">
                {/* Hide library's internal shaded region elements via CSS targeting */}
                <div 
                  id="barcode-live-scanner-viewport" 
                  className="w-full h-full object-cover [&>video]:object-cover [&>video]:w-full [&>video]:h-full [&_#qr-shaded-region]:!border-0 [&_#qr-shaded-region]:!bg-transparent" 
                />

                {/* Scanning Frame Overlay & Laser Line */}
                {isScanning && !detectedCode && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    {/* Scanning box boundary - matched to 80% width, 40% height to match qrbox calculation */}
                    <div className="w-[80%] h-[40%] border-2 border-blue-400/80 rounded-2xl relative shadow-[0_0_30px_rgba(59,130,246,0.4)] backdrop-brightness-110">
                      {/* Laser Line Animation */}
                      <div className="absolute inset-x-3 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_15px_#3b82f6] animate-[pulse_1s_infinite] top-1/2" />
                      
                      {/* Scan Pulse */}
                      <div className="absolute inset-0 border-4 border-blue-400/20 rounded-2xl animate-pulse" />

                      {/* Target corner accents */}
                      <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-xl" />
                      <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-xl" />
                      <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-xl" />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-xl" />
                    </div>

                    <div className="mt-8 flex flex-col items-center gap-2">
                      <div className="text-[11px] font-bold text-white bg-blue-600/90 px-4 py-1.5 rounded-full backdrop-blur-md shadow-lg border border-blue-400/30 animate-bounce">
                        將條碼對準框內中央
                      </div>
                      <div className="text-[10px] text-blue-200/80 font-medium">
                        提示：若無法辨識，請試著稍微拉遠或靠近
                      </div>
                    </div>
                  </div>
                )}

                {/* Detected Feedback Overlay */}
                {detectedCode && (
                  <div className="absolute inset-0 bg-blue-900/90 backdrop-blur-md flex flex-col items-center justify-center p-4 text-white animate-in zoom-in-95 duration-200">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-2 animate-bounce" />
                    <span className="text-xs text-blue-200 font-medium">成功讀取條碼</span>
                    <span className="text-lg font-mono font-black text-white tracking-widest mt-1">
                      {detectedCode}
                    </span>
                  </div>
                )}
              </div>

              {/* Camera Controls */}
              <div className="flex items-center justify-between gap-2 px-1">
                {availableCameras.length > 0 && (
                  <div className="relative flex-1 min-w-[140px] max-w-[210px]" ref={dropdownRef}>
                    {/* Custom Dropdown Trigger */}
                    <button
                      type="button"
                      onClick={() => setIsCameraDropdownOpen((prev) => !prev)}
                      className="w-full bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl pl-3 pr-8 py-2 transition flex items-center justify-between cursor-pointer shadow-2xs truncate relative"
                    >
                      <span className="truncate">
                        {availableCameras.find((c) => c.id === selectedCameraId)?.label || availableCameras[0]?.label || '選擇鏡頭'}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 transition-transform duration-200 ${
                          isCameraDropdownOpen ? 'rotate-180 text-blue-600' : ''
                        }`}
                      />
                    </button>

                    {/* Custom Styled Non-Native Dropdown Menu */}
                    {isCameraDropdownOpen && (
                      <div className="absolute bottom-full left-0 mb-1.5 w-full min-w-[170px] bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 p-1.5 space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <div className="px-2.5 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                          切換攝影機
                        </div>
                        {availableCameras.map((cam) => {
                          const isSelected =
                            cam.id === selectedCameraId || (!selectedCameraId && cam.id === availableCameras[0]?.id);
                          return (
                            <button
                              key={cam.id}
                              type="button"
                              onClick={() => {
                                setSelectedCameraId(cam.id);
                                setIsCameraDropdownOpen(false);
                                startCamera(cam.id);
                              }}
                              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-bold transition text-left cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                  : 'text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <span className="truncate pr-2">{cam.label}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1.5 ml-auto shrink-0">
                  {hasTorch && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      title={isTorchOn ? '關閉閃光燈' : '開啟閃光燈'}
                      className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center shrink-0 cursor-pointer ${
                        isTorchOn
                          ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-300'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                      }`}
                    >
                      <Flashlight className="w-4 h-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => startCamera(selectedCameraId)}
                    title="重新掃描"
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    重新掃描
                  </button>
                </div>
              </div>

              {/* iOS / Native Camera Quick Fallback Button */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98"
                >
                  <Camera className="w-4 h-4" />
                  開啟原生系統相機拍照 (iOS / 手機推薦)
                </button>
                <p className="text-[10px] text-slate-400 text-center mt-1">
                  若視訊畫面未顯示或權限受阻，請點擊上方按鈕拍攝
                </p>
              </div>
            </div>
          )}

          {/* FILE UPLOAD / PHOTO SNAPSHOT MODE */}
          {activeMode === 'file' && (
            <div className="space-y-3 py-1">
              <div className="grid grid-cols-2 gap-2.5">
                {/* Native Camera Action Card */}
                <button
                  type="button"
                  onClick={() => !isProcessingFile && nativeCameraInputRef.current?.click()}
                  className="border-2 border-blue-200 hover:border-blue-500 bg-blue-50/70 hover:bg-blue-100/80 rounded-2xl p-4 text-center transition cursor-pointer group flex flex-col items-center justify-center gap-2 active:scale-98"
                >
                  <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs group-hover:scale-110 transition">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-blue-950">開啟原生相機</h4>
                    <p className="text-[10px] text-blue-700 mt-0.5">直接調用系統相機拍照</p>
                  </div>
                </button>

                {/* Gallery Select Action Card */}
                <button
                  type="button"
                  onClick={() => !isProcessingFile && fileInputRef.current?.click()}
                  className="border-2 border-slate-200 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 rounded-2xl p-4 text-center transition cursor-pointer group flex flex-col items-center justify-center gap-2 active:scale-98"
                >
                  <div className="w-11 h-11 rounded-xl bg-slate-700 text-white flex items-center justify-center shadow-xs group-hover:scale-110 transition">
                    <Image className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-slate-800">選擇相簿照片</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">上傳手機已儲存的照片</p>
                  </div>
                </button>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-blue-700 bg-blue-50 px-3 py-2 rounded-xl border border-blue-100">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                自動執行條碼解碼，未讀取時自動啟動 AI 辨識
              </div>

              {isProcessingFile && (
                <div className="py-6 text-center space-y-2 bg-slate-50 rounded-2xl border border-slate-100">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                  <p className="text-xs font-bold text-blue-900">正在解析相片條碼數據...</p>
                  <p className="text-[11px] text-slate-400">正在執行條碼解碼與 AI 視覺辨識...</p>
                </div>
              )}
            </div>
          )}

          {/* Scan Error Message */}
          {scanError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex flex-col gap-2.5 animate-in fade-in duration-200 shadow-2xs">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed flex-1 font-medium">{scanError}</div>
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => startCamera(selectedCameraId)}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-2xs active:scale-98"
                >
                  再次嘗試請求權限
                </button>
                <button
                  type="button"
                  onClick={() => nativeCameraInputRef.current?.click()}
                  className="px-3 py-1.5 bg-white border border-rose-300 text-rose-900 font-bold text-xs rounded-xl transition hover:bg-rose-100/80 cursor-pointer active:scale-98"
                >
                  開啟原生相機拍照
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200 transition cursor-pointer"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};
