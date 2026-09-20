import React, { useEffect, useRef, useState } from 'react';
import { Camera, Image, X, Flashlight, RefreshCw, Sparkles, Check, ArrowLeft, AlertCircle, ChevronDown } from 'lucide-react';

interface AiCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptured: (base64: string, mimeType: string) => void;
}

/**
 * Format raw camera device labels to intuitive Chinese names (e.g., "後置鏡頭 1", "前置鏡頭 1")
 */
function formatCameraDevices<T extends { id?: string; deviceId?: string; label?: string }>(
  devices: T[]
): Array<{ id: string; label: string }> {
  let backCount = 0;
  let frontCount = 0;

  return devices.map((d, index) => {
    const id = d.id || d.deviceId || String(index);
    const rawLabel = (d.label || '').toLowerCase();

    const isFront =
      rawLabel.includes('front') ||
      rawLabel.includes('user') ||
      rawLabel.includes('前') ||
      rawLabel.includes('selfie') ||
      rawLabel.includes('facetime');

    const isBack =
      rawLabel.includes('back') ||
      rawLabel.includes('rear') ||
      rawLabel.includes('environment') ||
      rawLabel.includes('後') ||
      rawLabel.includes('main') ||
      rawLabel.includes('wide') ||
      rawLabel.includes('tele');

    let formattedName = '';
    if (isFront) {
      frontCount++;
      formattedName = `前置鏡頭 ${frontCount}`;
    } else if (isBack) {
      backCount++;
      formattedName = `後置鏡頭 ${backCount}`;
    } else {
      if (index === 0) {
        backCount++;
        formattedName = `後置鏡頭 ${backCount}`;
      } else if (index === 1 && frontCount === 0) {
        frontCount++;
        formattedName = `前置鏡頭 ${frontCount}`;
      } else {
        backCount++;
        formattedName = `後置鏡頭 ${backCount}`;
      }
    }

    return { id, label: formattedName };
  });
}

export const AiCameraModal: React.FC<AiCameraModalProps> = ({
  isOpen,
  onClose,
  onCaptured,
}) => {
  const [activeMode, setActiveMode] = useState<'camera' | 'file'>('camera');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isCameraDropdownOpen, setIsCameraDropdownOpen] = useState(false);

  // Captured photo preview state
  const [capturedImageBase64, setCapturedImageBase64] = useState<string | null>(null);
  const [capturedMimeType, setCapturedMimeType] = useState<string>('image/jpeg');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const activeRequestIdRef = useRef<number>(0);

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

  // Stop camera media stream
  const stopStream = () => {
    activeRequestIdRef.current += 1;
    if (videoRef.current) {
      videoRef.current.onloadedmetadata = null;
      try {
        videoRef.current.pause();
      } catch (pauseErr) {
        console.warn('[AiCameraModal] Pause failed:', pauseErr);
      }
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const srcStream = videoRef.current.srcObject as MediaStream;
      if (srcStream && srcStream.getTracks) {
        srcStream.getTracks().forEach((track) => track.stop());
      }
      videoRef.current.srcObject = null;
    }
    setIsTorchOn(false);
  };

  // Start live camera stream
  const startCamera = async (deviceId?: string) => {
    setCameraError('');
    stopStream(); // Increments activeRequestIdRef.current

    const myRequestId = activeRequestIdRef.current;

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError('您的瀏覽器不支援 WebRTC 即時鏡頭（或非 HTTPS 安全連線）。請使用下方按鈕拍攝或選擇相簿照片。');
      return;
    }

    let mediaStream: MediaStream | null = null;

    // Try 1: Exact or requested device ID / environment camera
    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (myRequestId !== activeRequestIdRef.current) {
        if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
        return;
      }
    } catch (err1) {
      if (myRequestId !== activeRequestIdRef.current) return;
      console.warn('AI Camera primary constraint failed, trying fallback 1:', err1);
      // Try 2: General environment facing mode
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (myRequestId !== activeRequestIdRef.current) {
          if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
          return;
        }
      } catch (err2) {
        if (myRequestId !== activeRequestIdRef.current) return;
        console.warn('AI Camera fallback 1 failed, trying fallback 2:', err2);
        // Try 3: Basic video stream
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (myRequestId !== activeRequestIdRef.current) {
            if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
            return;
          }
        } catch (err3) {
          if (myRequestId !== activeRequestIdRef.current) return;
          console.warn('All AI Camera constraints failed:', err3);
        }
      }
    }

    if (!mediaStream) {
      setCameraError('無法存取裝置相機鏡頭。請確認已開啟網站相機使用權限，或使用下方「開啟原生相機 / 上傳照片」。');
      return;
    }

    setStream(mediaStream);

    if (videoRef.current) {
      videoRef.current.srcObject = mediaStream;
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current && myRequestId === activeRequestIdRef.current) {
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              console.warn('[AiCameraModal] Playback interrupted safely:', err);
            });
          }
        }
      };
    }

    // Re-enumerate camera devices AFTER permission is granted to get accurate labels
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      if (myRequestId === activeRequestIdRef.current) {
        setAvailableCameras(videoDevices);
      }
    } catch (enumErr) {
      console.warn('Device enumeration error:', enumErr);
    }

    // Check flashlight support
    try {
      const track = mediaStream.getVideoTracks()[0];
      if (track && 'getCapabilities' in track) {
        const capabilities = (track as any).getCapabilities();
        if (capabilities && capabilities.torch && myRequestId === activeRequestIdRef.current) {
          setHasTorch(true);
        }
      }
    } catch (e) {
      console.warn('Torch check warning:', e);
    }
  };

  // Toggle flashlight
  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track && 'applyConstraints' in track) {
      try {
        const nextState = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setIsTorchOn(nextState);
      } catch (e) {
        console.warn('Torch toggle error:', e);
      }
    }
  };

  // Capture snapshot from live camera feed
  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    setCapturedImageBase64(dataUrl);
    setCapturedMimeType('image/jpeg');
    stopStream();
  };

  // Handle file select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const mime = file.type || 'image/jpeg';
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target?.result as string;
      if (base64) {
        setCapturedImageBase64(base64);
        setCapturedMimeType(mime);
      }
    };
    reader.readAsDataURL(file);
  };

  // Retake photo
  const handleRetake = () => {
    setCapturedImageBase64(null);
    if (activeMode === 'camera') {
      startCamera(selectedCameraId);
    }
  };

  // Confirm photo and trigger Gemini AI analysis
  const handleConfirm = () => {
    if (!capturedImageBase64) return;
    stopStream();
    onCaptured(capturedImageBase64, capturedMimeType);
    onClose();
  };

  useEffect(() => {
    if (isOpen && activeMode === 'camera' && !capturedImageBase64) {
      const timer = setTimeout(() => {
        startCamera(selectedCameraId);
      }, 300);
      return () => {
        clearTimeout(timer);
        stopStream();
      };
    } else {
      stopStream();
    }
  }, [isOpen, activeMode, selectedCameraId, capturedImageBase64]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-400/30 flex items-center justify-center text-purple-300">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-wide">Gemini AI 飲食相機</h3>
              <p className="text-[10px] text-purple-200">拍攝食物或菜單，由 AI 自動辨識估算營養</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher (Hidden when photo is captured and pending review) */}
        {!capturedImageBase64 && (
          <div className="p-2 bg-slate-100 border-b border-slate-200 flex gap-1 shrink-0">
            <button
              onClick={() => {
                setCapturedImageBase64(null);
                setActiveMode('camera');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeMode === 'camera'
                  ? 'bg-white text-purple-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              即時相機鏡頭
            </button>
            <button
              onClick={() => {
                setCapturedImageBase64(null);
                setActiveMode('file');
              }}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                activeMode === 'file'
                  ? 'bg-white text-purple-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Image className="w-3.5 h-3.5" />
              選擇相簿照片
            </button>
          </div>
        )}

        {/* Main Content Viewport */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          {/* Always rendered hidden file inputs so refs remain valid in any mode */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <input
            ref={nativeCameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* 1. CAPTURED PREVIEW STATE */}
          {capturedImageBase64 ? (
            <div className="space-y-4 text-center">
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-[4/3] border border-slate-200 shadow-sm mx-auto">
                <img
                  src={capturedImageBase64}
                  alt="Captured food"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 bg-slate-900/80 text-white text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-sm border border-white/20">
                  照片已準備就緒
                </div>
              </div>

              <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl text-xs text-purple-900 space-y-1">
                <div className="font-extrabold flex items-center justify-center gap-1">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  確認相片無誤後，點擊「開始 AI 辨識」
                </div>
                <p className="text-[11px] text-purple-700">
                  Gemini AI 將分析食材品項、份量與三大營養素，並給予營養評估。
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  重新拍攝 / 選擇
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-2xl shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                >
                  <Check className="w-4 h-4" />
                  開始 AI 辨識
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 2. LIVE CAMERA STREAM MODE */}
              {activeMode === 'camera' && (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-[4/3] border border-slate-800 shadow-inner flex items-center justify-center">
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />

                    {/* Camera Overlay Frame */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-[85%] h-[75%] border-2 border-dashed border-purple-400/60 rounded-2xl relative shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-purple-500 rounded-tl-lg" />
                        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-purple-500 rounded-tr-lg" />
                        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-purple-500 rounded-bl-lg" />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-purple-500 rounded-br-lg" />
                      </div>

                      <div className="absolute bottom-3 text-[11px] font-bold text-white/90 bg-slate-900/80 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
                        請將食物或標籤放置於框內
                      </div>
                    </div>
                  </div>

                  {/* Camera Controls & Shutter Button */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-center">
                      {/* Big Shutter Button */}
                      <button
                        type="button"
                        onClick={takeSnapshot}
                        className="w-16 h-16 rounded-full border-4 border-purple-500 bg-white p-1 hover:scale-105 transition shadow-lg cursor-pointer flex items-center justify-center group active:scale-95"
                      >
                        <div className="w-full h-full rounded-full bg-purple-600 group-hover:bg-purple-700 transition flex items-center justify-center">
                          <Camera className="w-6 h-6 text-white" />
                        </div>
                      </button>
                    </div>

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
                              {formatCameraDevices(availableCameras).find((c) => c.id === selectedCameraId)?.label ||
                                formatCameraDevices(availableCameras)[0]?.label ||
                                '選擇鏡頭'}
                            </span>
                            <ChevronDown
                              className={`w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 transition-transform duration-200 ${
                                isCameraDropdownOpen ? 'rotate-180 text-purple-600' : ''
                              }`}
                            />
                          </button>

                          {/* Custom Styled Non-Native Dropdown Menu */}
                          {isCameraDropdownOpen && (
                            <div className="absolute bottom-full left-0 mb-1.5 w-full min-w-[170px] bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 p-1.5 space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
                              <div className="px-2.5 py-1 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                                切換攝影機
                              </div>
                              {formatCameraDevices(availableCameras).map((cam) => {
                                const isSelected =
                                  cam.id === selectedCameraId ||
                                  (!selectedCameraId && cam.id === formatCameraDevices(availableCameras)[0]?.id);
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
                                        ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                        : 'text-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    <span className="truncate pr-2">{cam.label}</span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-purple-600 shrink-0" />}
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
                          title="重啟鏡頭"
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          重啟鏡頭
                        </button>
                      </div>
                    </div>

                    {/* iOS / Native Camera Fallback Button */}
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => nativeCameraInputRef.current?.click()}
                        className="w-full py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98"
                      >
                        <Camera className="w-4 h-4" />
                        開啟 iOS / 原生系統相機拍攝
                      </button>
                      <p className="text-[10px] text-slate-400 text-center mt-1">
                        免除網頁瀏覽器相機權限阻擋，適用於 iOS Safari / Line 內建瀏覽器
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. FILE / GALLERY MODE */}
              {activeMode === 'file' && (
                <div className="space-y-3 py-1">
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Native Camera Action Card */}
                    <button
                      type="button"
                      onClick={() => nativeCameraInputRef.current?.click()}
                      className="border-2 border-purple-200 hover:border-purple-500 bg-purple-50/70 hover:bg-purple-100/80 rounded-2xl p-4 text-center transition cursor-pointer group flex flex-col items-center justify-center gap-2 active:scale-98"
                    >
                      <div className="w-11 h-11 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs group-hover:scale-110 transition">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs text-purple-950">開啟原生相機</h4>
                        <p className="text-[10px] text-purple-700 mt-0.5">直接調用系統相機拍照</p>
                      </div>
                    </button>

                    {/* Gallery Select Action Card */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
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

                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-purple-700 bg-purple-50 px-3 py-2 rounded-xl border border-purple-100">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    選擇或拍攝照片後，由 Gemini AI 自動進行全方位營養估算
                  </div>
                </div>
              )}

              {/* Camera Access Error Message */}
              {cameraError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{cameraError}</div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
          <button
            onClick={() => {
              stopStream();
              onClose();
            }}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200 transition cursor-pointer"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};
