import React, { useEffect, useRef, useState } from 'react';
import { Camera, Image, X, Flashlight, RefreshCw, ScanText, Check, ArrowLeft, AlertCircle, ChevronDown, Clock, RotateCw, RotateCcw, Loader2 } from 'lucide-react';
import { useModalBackHandler } from '../hooks/useModalBackHandler';
import { rotateBase64Image } from '../utils/imagePreprocessing';

interface OcrCameraModalProps {
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

export const OcrCameraModal: React.FC<OcrCameraModalProps> = ({
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
  const [isExiting, setIsExiting] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const isStoppingRef = useRef(false);

  // Captured photo preview state
  const [capturedImageBase64, setCapturedImageBase64] = useState<string | null>(null);
  const [capturedMimeType, setCapturedMimeType] = useState<string>('image/jpeg');
  const [isRotatingImage, setIsRotatingImage] = useState(false);

  const handleRotateCaptured = async (degrees: number) => {
    if (!capturedImageBase64 || isRotatingImage) return;
    try {
      setIsRotatingImage(true);
      const rotated = await rotateBase64Image(capturedImageBase64, degrees);
      setCapturedImageBase64(rotated);
    } catch (err) {
      console.error('Failed to rotate captured photo:', err);
    } finally {
      setIsRotatingImage(false);
    }
  };

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const nativeCameraInputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const activeRequestIdRef = useRef<number>(0);

  const handleClose = async () => {
    if (isExiting) return;
    setIsExiting(true);
    await stopStream();
    onClose();
  };

  useModalBackHandler(isOpen, handleClose);

  // Synchronize isOpen with shouldRender and handle automatic exit cleanup
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsExiting(false);
    } else if (shouldRender) {
      setIsExiting(true);
      stopStream();
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 350); // Slightly longer than CSS transition
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

  // Stop camera media stream
  const stopStream = async () => {
    activeRequestIdRef.current += 1;

    try {
      const allVideos = document.querySelectorAll('video');
      allVideos.forEach(v => {
        if (v.srcObject) {
          try {
            const ms = v.srcObject as MediaStream;
            if (ms && ms.getTracks) {
              ms.getTracks().forEach(t => t.stop());
            }
            v.srcObject = null;
          } catch {}
        }
      });
    } catch {}

    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    try {
      if (stream) {
        try {
          stream.getTracks().forEach((track) => track.stop());
        } catch {}
        setStream(null);
      }
      
      if (videoRef.current) {
        const v = videoRef.current;
        v.onloadedmetadata = null;
        if (v.srcObject) {
          try {
            const ms = v.srcObject as MediaStream;
            if (ms && ms.getTracks) {
              ms.getTracks().forEach(t => t.stop());
            }
          } catch {}
          v.srcObject = null;
        }
        try {
          v.pause();
        } catch {}
      }
      
      setIsTorchOn(false);
      await new Promise(r => setTimeout(r, 100));
    } finally {
      isStoppingRef.current = false;
    }
  };

  // Start live camera stream
  const startCamera = async (deviceId?: string) => {
    setCameraError('');
    await stopStream(); 

    const myRequestId = activeRequestIdRef.current;

    if (!navigator?.mediaDevices?.getUserMedia) {
      setCameraError('您的瀏覽器不支援 WebRTC 即時鏡頭。請使用下方按鈕拍攝或選擇相簿照片。');
      return;
    }

    let mediaStream: MediaStream | null = null;

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
      console.warn('OCR Camera constraint failed, trying fallback:', err1);
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
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (myRequestId !== activeRequestIdRef.current) {
            if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
            return;
          }
        } catch (err3) {
          if (myRequestId !== activeRequestIdRef.current) return;
          console.warn('All OCR Camera constraints failed:', err3);
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
      const video = videoRef.current;
      if (video && video.isConnected) {
        try {
          const playPromise = video.play();
          if (playPromise !== undefined) {
            await playPromise;
          }
        } catch (err: any) {
          console.log('[OcrCameraModal] Playback interrupted or blocked safely:', err.name || 'Interrupted');
        }
      }
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      if (myRequestId === activeRequestIdRef.current) {
        setAvailableCameras(videoDevices);
      }
    } catch (enumErr) {
      console.warn('Device enumeration error:', enumErr);
    }

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

  // Capture snapshot from video stream
  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImageBase64(dataUrl);
        setCapturedMimeType('image/jpeg');
      }
    } catch (err) {
      console.error('Take snapshot error:', err);
    }
  };

  // Handle native file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mime = file.type || 'image/jpeg';
    setCapturedMimeType(mime);
    const reader = new FileReader();
    reader.onload = () => {
      setCapturedImageBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Confirm and return captured image
  const handleConfirmCaptured = () => {
    if (capturedImageBase64) {
      onCaptured(capturedImageBase64, capturedMimeType);
      handleClose();
    }
  };

  // Toggle back to stream view or clear preview
  const handleClearCaptured = () => {
    setCapturedImageBase64(null);
    if (activeMode === 'camera') {
      startCamera(selectedCameraId);
    }
  };

  useEffect(() => {
    if (isOpen && activeMode === 'camera' && !capturedImageBase64) {
      // Delay initialization slightly to let transition finish and elements attach
      const initTimer = setTimeout(() => {
        startCamera();
      }, 200);
      return () => clearTimeout(initTimer);
    }
  }, [isOpen, activeMode]);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-opacity duration-300 ${
        isOpen && !isExiting ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {/* Hidden inputs for iOS system camera and gallery */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={nativeCameraInputRef}
        onChange={handleFileChange}
        accept="image/*"
        capture="environment"
        className="hidden"
      />

      <div
        className={`bg-white w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[82vh] sm:h-[75vh] max-h-[640px] transition-transform duration-300 scale-in-95 ${
          isOpen && !isExiting ? 'scale-100' : 'scale-95'
        }`}
      >
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-white/20">
              <ScanText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-wide">OCR 營養標示拍攝鏡頭</h3>
              <p className="text-[10px] text-emerald-100 font-semibold">請對準包裝上的營養標示表</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-emerald-100 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-100 p-1.5 mx-4 mt-4 rounded-2xl shrink-0 gap-1 border border-slate-200/40">
          <button
            type="button"
            onClick={() => {
              setActiveMode('camera');
              setCapturedImageBase64(null);
            }}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMode === 'camera'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            即時相機拍攝
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveMode('file');
              setCapturedImageBase64(null);
              stopStream();
            }}
            className={`flex-1 py-2 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeMode === 'file'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Image className="w-3.5 h-3.5" />
            上傳與原生相機
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between">
          {capturedImageBase64 ? (
            /* 1. CONFIRM CAPTURE / PHOTO PREVIEW STATE */
            <div className="flex-1 flex flex-col justify-between py-1.5">
              <div className="text-center space-y-2 mb-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-black rounded-full border border-emerald-100">
                  <Check className="w-3 h-3 text-emerald-600" />
                  已成功截取影像
                </span>
                <p className="text-[11px] text-slate-500 font-bold">請確認標示表清晰不失焦，以達到最佳辨識品質</p>
              </div>

              <div className="relative flex-1 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden max-h-[300px]">
                <img
                  src={capturedImageBase64}
                  alt="Captured Preview"
                  className="w-full h-full object-contain rounded-2xl"
                />

                {/* Floating Quick Rotate Buttons Overlay */}
                <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-slate-900/80 backdrop-blur-md p-1 rounded-xl shadow-md border border-white/20">
                  <button
                    type="button"
                    disabled={isRotatingImage}
                    onClick={() => handleRotateCaptured(270)}
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
                    onClick={() => handleRotateCaptured(90)}
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
                    onClick={() => handleRotateCaptured(180)}
                    className="px-1.5 py-1 text-white/90 hover:text-white hover:bg-white/20 rounded-lg transition active:scale-90 cursor-pointer text-[10px] font-bold disabled:opacity-50"
                    title="翻轉 180°"
                  >
                    180°
                  </button>
                </div>

                {isRotatingImage && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-2xs rounded-2xl flex flex-col items-center justify-center text-white text-xs font-bold gap-1.5 z-20 animate-in fade-in duration-150">
                    <Loader2 className="w-6 h-6 animate-spin text-white" />
                    <span>旋轉轉正中...</span>
                  </div>
                )}
              </div>

              {/* Quick Rotate Toolbar */}
              <div className="flex items-center justify-center gap-2 mt-2.5">
                <button
                  type="button"
                  disabled={isRotatingImage}
                  onClick={() => handleRotateCaptured(270)}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/70 rounded-xl text-xs font-bold hover:bg-emerald-100 transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-2xs disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  向左轉 90°
                </button>
                <button
                  type="button"
                  disabled={isRotatingImage}
                  onClick={() => handleRotateCaptured(90)}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200/70 rounded-xl text-xs font-bold hover:bg-emerald-100 transition cursor-pointer flex items-center gap-1 active:scale-95 shadow-2xs disabled:opacity-50"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  向右轉 90°
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 shrink-0">
                <button
                  type="button"
                  onClick={handleClearCaptured}
                  className="py-3 border border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 transition"
                >
                  <ArrowLeft className="w-4 h-4" />
                  重拍 / 清除
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCaptured}
                  className="py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 transition shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  確認使用此照片
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* 2. LIVE CAMERA STREAM STATE */}
              {activeMode === 'camera' && !cameraError && (
                <div className="flex-1 flex flex-col justify-between min-h-[320px]">
                  {/* Camera viewframe overlay box */}
                  <div className="relative flex-1 bg-black rounded-2xl overflow-hidden flex items-center justify-center min-h-[180px] group border border-slate-900 shadow-inner">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover rounded-2xl"
                    />

                    {/* OCR scan target reticle overlay (綠色 OCR 專屬掃描框) */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center bg-black/35">
                      <div className="w-[82%] h-[55%] border-2 border-emerald-400 rounded-xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                        {/* Corners */}
                        <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-500 rounded-tl-md"></div>
                        <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-500 rounded-tr-md"></div>
                        <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-500 rounded-bl-md"></div>
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-500 rounded-br-md"></div>

                        {/* Scan Line Overlay */}
                        <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent top-1/2 -translate-y-1/2 animate-pulse"></div>

                        {/* Text hint */}
                        <div className="absolute inset-x-0 -bottom-8 text-center">
                          <span className="bg-emerald-600/90 text-white px-2.5 py-0.75 rounded-full text-[9px] font-bold tracking-wider whitespace-nowrap shadow-xs backdrop-blur-xs">
                            請將「營養標示表」置於此方框內
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Camera Controls & Shutter Button */}
                  <div className="space-y-2 pt-2.5">
                    <div className="bg-emerald-50/90 border border-emerald-200/80 rounded-xl px-3 py-1.5 text-center flex items-center justify-center gap-1.5 text-[10px] font-bold text-emerald-900">
                      <span>💡 拍攝秘訣：正面平行對齊・避開光線反光・讓表格填滿框線</span>
                    </div>

                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={takeSnapshot}
                        className="w-15 h-15 rounded-full border-4 border-emerald-500 bg-white p-1 hover:scale-105 transition shadow-lg cursor-pointer flex items-center justify-center group active:scale-95"
                      >
                        <div className="w-full h-full rounded-full bg-emerald-600 group-hover:bg-emerald-700 transition flex items-center justify-center">
                          <Camera className="w-5.5 h-5.5 text-white" />
                        </div>
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2 px-1">
                      {availableCameras.length > 0 && (
                        <div className="relative flex-1 min-w-[130px] max-w-[200px]" ref={dropdownRef}>
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
                                isCameraDropdownOpen ? 'rotate-180 text-emerald-600' : ''
                              }`}
                            />
                          </button>

                          {isCameraDropdownOpen && (
                            <div className="absolute bottom-full left-0 mb-1.5 w-full min-w-[160px] bg-white border border-slate-200/90 rounded-2xl shadow-xl z-50 p-1.5 space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
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
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                        : 'text-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    <span className="truncate pr-2">{cam.label}</span>
                                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
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

                    {/* Native Fallback Trigger */}
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => nativeCameraInputRef.current?.click()}
                        className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98"
                      >
                        <Camera className="w-4 h-4" />
                        開啟系統相機（相機權限受阻時用）
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. FILE / GALLERY MODE */}
              {activeMode === 'file' && (
                <div className="space-y-3 py-1 flex-1 flex flex-col justify-center">
                  <div className="grid grid-cols-2 gap-2.5 max-w-sm mx-auto w-full">
                    <button
                      type="button"
                      onClick={() => nativeCameraInputRef.current?.click()}
                      className="border-2 border-emerald-200 hover:border-emerald-500 bg-emerald-50/70 hover:bg-emerald-100/80 rounded-2xl p-4 text-center transition cursor-pointer group flex flex-col items-center justify-center gap-2 active:scale-98"
                    >
                      <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs group-hover:scale-110 transition">
                        <Camera className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs text-emerald-950">開啟原生相機</h4>
                        <p className="text-[10px] text-emerald-700 mt-0.5">直接調用系統相機拍照</p>
                      </div>
                    </button>

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

                  <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100 max-w-sm mx-auto mt-4">
                    <ScanText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>上傳照片後，將能自動由 AI 進行結構化 OCR 解析</span>
                  </div>
                </div>
              )}

              {/* Camera Access Error Message */}
              {cameraError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex flex-col gap-2.5 animate-in fade-in duration-200 shadow-2xs">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="leading-relaxed flex-1 font-medium">{cameraError}</div>
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => startCamera(selectedCameraId)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-2xs active:scale-98"
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
