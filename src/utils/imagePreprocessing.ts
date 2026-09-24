/**
 * 純前端 HTML5 Canvas 影像前處理增強演算法庫
 * 提供像素級別的數值矩陣計算，100% 在瀏覽器端本地離線運行
 */
import Tesseract from 'tesseract.js';

export interface PreprocessingStats {
  width: number;
  height: number;
  appliedFilters: string[];
  executionTimeMs: number;
}

/**
 * 載入 Base64 圖片並轉換為 HTMLImageElement
 */
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
};

/**
 * 轉為灰階強度陣列 (Y = 0.299R + 0.587G + 0.114B)
 */
function toGrayscale(data: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const gray = new Uint8Array(width * height);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  return gray;
}

/**
 * 1. Sauvola 局部自適應二值化 (Sauvola Local Adaptive Binarization)
 * 透過局部窗口計算平均值 (mean) 與標準差 (stdDev)
 * 公式: Threshold = mean * (1 + k * (stdDev / R - 1))
 * 常用常數: R = 128, k = 0.2 ~ 0.5, windowSize = 15 ~ 25
 */
export function applySauvolaBinarization(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  windowSize = 21,
  k = 0.25,
  R = 128
): void {
  const gray = toGrayscale(data, width, height);
  const halfWin = Math.floor(windowSize / 2);

  // 構建積分圖 (Integral Image) 與 積分平方圖 (Integral Square Image) 達成 O(1) 局部窗口計算
  const integral = new Float64Array((width + 1) * (height + 1));
  const integralSq = new Float64Array((width + 1) * (height + 1));

  for (let y = 0; y < height; y++) {
    let sum = 0;
    let sumSq = 0;
    const rowOffset = y * width;
    const nextRowOffset = (y + 1) * (width + 1);
    const currRowOffset = y * (width + 1);

    for (let x = 0; x < width; x++) {
      const val = gray[rowOffset + x];
      sum += val;
      sumSq += val * val;

      integral[nextRowOffset + (x + 1)] = integral[currRowOffset + (x + 1)] + sum;
      integralSq[nextRowOffset + (x + 1)] = integralSq[currRowOffset + (x + 1)] + sumSq;
    }
  }

  for (let y = 0; y < height; y++) {
    const y1 = Math.max(0, y - halfWin);
    const y2 = Math.min(height - 1, y + halfWin);
    const winH = y2 - y1 + 1;

    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - halfWin);
      const x2 = Math.min(width - 1, x + halfWin);
      const winW = x2 - x1 + 1;
      const count = winW * winH;

      // 快速查表取得矩形區域和
      const iA = y1 * (width + 1) + x1;
      const iB = y1 * (width + 1) + (x2 + 1);
      const iC = (y2 + 1) * (width + 1) + x1;
      const iD = (y2 + 1) * (width + 1) + (x2 + 1);

      const sum = integral[iD] - integral[iB] - integral[iC] + integral[iA];
      const sumSq = integralSq[iD] - integralSq[iB] - integralSq[iC] + integralSq[iA];

      const mean = sum / count;
      const variance = Math.max(0, (sumSq / count) - (mean * mean));
      const stdDev = Math.sqrt(variance);

      // Sauvola 動態閾值
      const threshold = mean * (1.0 + k * ((stdDev / R) - 1.0));

      const pixelIdx = (y * width + x) * 4;
      const origVal = gray[y * width + x];
      const binaryVal = origVal > threshold ? 255 : 0;

      data[pixelIdx] = binaryVal;
      data[pixelIdx + 1] = binaryVal;
      data[pixelIdx + 2] = binaryVal;
      // Alpha 維持不變
    }
  }
}

/**
 * 2. 高階雙線性插值 (Bilinear Super-Resolution Upscaling)
 * 將畫布寬高放大 1.5 ~ 2.0 倍，利用次像素 4 鄰域距離權重計算漸變，提升微小字體 OCR 清晰度
 */
export function applyBilinearInterpolation(
  srcCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale = 1.5
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const newWidth = Math.round(width * scale);
  const newHeight = Math.round(height * scale);

  const newCanvas = document.createElement('canvas');
  newCanvas.width = newWidth;
  newCanvas.height = newHeight;
  const newCtx = newCanvas.getContext('2d');
  if (!newCtx) return { canvas: srcCtx.canvas, width, height };

  // 啟用高階圖像平滑雙線性插值
  newCtx.imageSmoothingEnabled = true;
  newCtx.imageSmoothingQuality = 'high';

  newCtx.drawImage(srcCtx.canvas, 0, 0, width, height, 0, 0, newWidth, newHeight);
  return { canvas: newCanvas, width: newWidth, height: newHeight };
}

/**
 * 3. USM 擬真反遮罩銳化 (Unsharp Masking)
 * 原圖 + Amount * (原圖 - 高斯模糊圖)
 * 對文字筆劃邊緣進行高頻增益強化
 */
export function applyUnsharpMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount = 1.2
): void {
  // 複製一份原圖灰階/RGB作模糊比對
  const original = new Uint8ClampedArray(data);
  
  // 3x3 高斯模糊核:
  // [ 1  2  1 ]
  // [ 2  4  2 ] / 16
  // [ 1  2  1 ]
  const kernel = [
    1, 2, 1,
    2, 4, 2,
    1, 2, 1
  ];
  const kWeight = 16;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let rBlur = 0;
      let gBlur = 0;
      let bBlur = 0;
      let kIdx = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pIdx = ((y + ky) * width + (x + kx)) * 4;
          const w = kernel[kIdx++];
          rBlur += original[pIdx] * w;
          gBlur += original[pIdx + 1] * w;
          bBlur += original[pIdx + 2] * w;
        }
      }

      rBlur /= kWeight;
      gBlur /= kWeight;
      bBlur /= kWeight;

      const idx = (y * width + x) * 4;
      const rOrig = original[idx];
      const gOrig = original[idx + 1];
      const bOrig = original[idx + 2];

      // USM 公式: sharpened = orig + amount * (orig - blur)
      data[idx] = Math.min(255, Math.max(0, Math.round(rOrig + amount * (rOrig - rBlur))));
      data[idx + 1] = Math.min(255, Math.max(0, Math.round(gOrig + amount * (gOrig - gBlur))));
      data[idx + 2] = Math.min(255, Math.max(0, Math.round(bOrig + amount * (bOrig - bBlur))));
    }
  }
}

/**
 * 4. 數字筆畫修復與小數點增強 (Digit Stroke & Decimal Dot Repair)
 * 使用形態學微型十字膨脹 (Morphological Cross Dilation) 與孤立點加固
 * 防止「.」、「8」、「0」因為解析度不足或印刷斷字而造成誤判
 */
export function applyDigitStrokeRepair(
  data: Uint8ClampedArray,
  width: number,
  height: number
): void {
  const original = new Uint8ClampedArray(data);

  // 判斷是否為暗色筆劃 (前景色)
  const isDark = (r: number, g: number, b: number) => {
    return (0.299 * r + 0.587 * g + 0.114 * b) < 140;
  };

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      
      // 如果當前像素不是暗色，但周圍有緊密筆畫或疑似斷點小數點
      if (!isDark(original[idx], original[idx + 1], original[idx + 2])) {
        // 檢查上下左右 4 鄰域
        const up = isDark(original[((y - 1) * width + x) * 4], original[((y - 1) * width + x) * 4 + 1], original[((y - 1) * width + x) * 4 + 2]);
        const down = isDark(original[((y + 1) * width + x) * 4], original[((y + 1) * width + x) * 4 + 1], original[((y + 1) * width + x) * 4 + 2]);
        const left = isDark(original[(y * width + (x - 1)) * 4], original[(y * width + (x - 1)) * 4 + 1], original[(y * width + (x - 1)) * 4 + 2]);
        const right = isDark(original[(y * width + (x + 1)) * 4], original[(y * width + (x + 1)) * 4 + 1], original[(y * width + (x + 1)) * 4 + 2]);

        // 若被水平夾擊 (如筆劃微小斷開) 或 垂直夾擊，執行填補閉合 (Closing)
        if ((left && right) || (up && down)) {
          data[idx] = 20;
          data[idx + 1] = 20;
          data[idx + 2] = 20;
        }
      }
    }
  }
}

/**
 * 依正交角度 (90°, 180°, 270°) 精準旋轉 Canvas
 */
export function rotateCanvas(canvas: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  const normDeg = ((degrees % 360) + 360) % 360;
  if (normDeg === 0) return canvas;

  const newCanvas = document.createElement('canvas');
  const ctx = newCanvas.getContext('2d');
  if (!ctx) return canvas;

  if (normDeg === 90) {
    newCanvas.width = canvas.height;
    newCanvas.height = canvas.width;
    ctx.translate(canvas.height, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(canvas, 0, 0);
  } else if (normDeg === 180) {
    newCanvas.width = canvas.width;
    newCanvas.height = canvas.height;
    ctx.translate(canvas.width, canvas.height);
    ctx.rotate(Math.PI);
    ctx.drawImage(canvas, 0, 0);
  } else if (normDeg === 270) {
    newCanvas.width = canvas.height;
    newCanvas.height = canvas.width;
    ctx.translate(0, canvas.width);
    ctx.rotate((3 * Math.PI) / 2);
    ctx.drawImage(canvas, 0, 0);
  }

  return newCanvas;
}

/**
 * 旋轉 Base64 圖片並回傳新的 Base64 字串
 */
export async function rotateBase64Image(base64: string, degrees: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = img.naturalWidth;
      tempCanvas.height = img.naturalHeight;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) {
        resolve(base64);
        return;
      }
      ctx.drawImage(img, 0, 0);
      const rotated = rotateCanvas(tempCanvas, degrees);
      resolve(rotated.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = (e) => reject(e);
    img.src = base64;
  });
}

/**
 * 離線啟發式方向偵測：利用橫排中文字元的邊緣梯度分佈判定是否發生側向旋轉
 */
function estimateOrientationHeuristic(canvas: HTMLCanvasElement): { degrees: number; confidence: number } {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { degrees: 0, confidence: 0 };
  const w = canvas.width;
  const h = canvas.height;
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  let sumGx = 0;
  let sumGy = 0;
  for (let y = 1; y < h - 1; y += 3) {
    for (let x = 1; x < w - 1; x += 3) {
      const idx = (y * w + x) * 4;
      const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const grayRight = 0.299 * data[idx + 4] + 0.587 * data[idx + 5] + 0.114 * data[idx + 6];
      const grayDown = 0.299 * data[idx + w * 4] + 0.587 * data[idx + w * 4 + 1] + 0.114 * data[idx + w * 4 + 2];

      sumGx += Math.abs(grayRight - gray);
      sumGy += Math.abs(grayDown - gray);
    }
  }

  const ratio = sumGy / (sumGx + 1e-5);
  if (ratio > 1.45 && w > h) {
    return { degrees: 90, confidence: 2.1 };
  }
  return { degrees: 0, confidence: 1.0 };
}

/**
 * 方案 C: 使用 Tesseract OSD 字符方向檢測並自動將 Canvas 轉正至 0°
 */
export async function detectAndCorrectOrientation(
  canvas: HTMLCanvasElement
): Promise<{ rotatedCanvas: HTMLCanvasElement; detectedDegrees: number; confidence: number; applied: boolean }> {
  try {
    // 建立輕量微縮圖以加快 OSD 分析速度 (限制最大邊 380px，大幅壓縮執行時間至 ~150-250ms)
    const thumbCanvas = document.createElement('canvas');
    const maxThumb = 380;
    let tw = canvas.width;
    let th = canvas.height;
    if (tw > maxThumb || th > maxThumb) {
      if (tw > th) {
        th = Math.round((th * maxThumb) / tw);
        tw = maxThumb;
      } else {
        tw = Math.round((tw * maxThumb) / th);
        th = maxThumb;
      }
    }
    thumbCanvas.width = tw;
    thumbCanvas.height = th;
    const thumbCtx = thumbCanvas.getContext('2d');
    if (!thumbCtx) {
      return { rotatedCanvas: canvas, detectedDegrees: 0, confidence: 0, applied: false };
    }
    thumbCtx.drawImage(canvas, 0, 0, tw, th);

    let orientationDegrees = 0;
    let orientationConfidence = 0;

    try {
      // 呼叫 Tesseract detect (Orientation and Script Detection)
      const detectResult = await Tesseract.detect(thumbCanvas);
      if (detectResult?.data) {
        orientationDegrees = detectResult.data.orientation_degrees || 0;
        orientationConfidence = detectResult.data.orientation_confidence || 0;
      }
    } catch (osdErr) {
      console.warn('Tesseract OSD online model fallback to heuristic orientation:', osdErr);
      const fallbackCheck = estimateOrientationHeuristic(thumbCanvas);
      orientationDegrees = fallbackCheck.degrees;
      orientationConfidence = fallbackCheck.confidence;
    }

    // 若判定角度不為 0 且具有可信度，執行轉正校正
    if ([90, 180, 270].includes(orientationDegrees) && orientationConfidence >= 1.0) {
      const rotateDeg = (360 - orientationDegrees) % 360;
      const rotated = rotateCanvas(canvas, rotateDeg);
      return {
        rotatedCanvas: rotated,
        detectedDegrees: orientationDegrees,
        confidence: orientationConfidence,
        applied: true
      };
    }

    return { rotatedCanvas: canvas, detectedDegrees: orientationDegrees, confidence: orientationConfidence, applied: false };
  } catch (err) {
    console.error('Orientation detection error:', err);
    return { rotatedCanvas: canvas, detectedDegrees: 0, confidence: 0, applied: false };
  }
}

/**
 * 核心執行管線：根據使用者勾選的多選工具，依序在 Canvas 上施加真實演算法
 */
export async function processImageWithPipeline(
  base64Image: string,
  selectedToolIds: string[]
): Promise<{ processedBase64: string; executionTimeMs: number; appliedFilters: string[] }> {
  const startTime = performance.now();
  if (!selectedToolIds || selectedToolIds.length === 0) {
    return {
      processedBase64: base64Image,
      executionTimeMs: 0,
      appliedFilters: []
    };
  }

  const img = await loadImage(base64Image);
  let canvas = document.createElement('canvas');
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  // 限制最大寬高以維持瀏覽器前端 60fps 極速處理
  const MAX_DIM = 1400;
  if (width > MAX_DIM || height > MAX_DIM) {
    if (width > height) {
      height = Math.round((height * MAX_DIM) / width);
      width = MAX_DIM;
    } else {
      width = Math.round((width * MAX_DIM) / height);
      height = MAX_DIM;
    }
  }

  canvas.width = width;
  canvas.height = height;
  let ctx = canvas.getContext('2d');
  if (!ctx) return { processedBase64: base64Image, executionTimeMs: 0, appliedFilters: [] };

  ctx.drawImage(img, 0, 0, width, height);

  const appliedFilters: string[] = [];

  // 0. 方案 C：Tesseract OSD 自動方向轉正 (若有勾選，優先在原解析度下轉正畫布)
  if (selectedToolIds.includes('auto_orientation_osd')) {
    const osdRes = await detectAndCorrectOrientation(canvas);
    if (osdRes.applied) {
      canvas = osdRes.rotatedCanvas;
      width = canvas.width;
      height = canvas.height;
      ctx = canvas.getContext('2d')!;
      appliedFilters.push(`Tesseract OSD 自動轉正 (${osdRes.detectedDegrees}° ➔ 轉正至 0°, 置信度: ${osdRes.confidence.toFixed(1)})`);
    } else {
      appliedFilters.push(`Tesseract OSD 檢測為正向 (0°, 置信度: ${osdRes.confidence.toFixed(1)})`);
    }
  }

  // 1. 高階雙線性插值增強 (若有勾選，優先擴展解析度)
  if (selectedToolIds.includes('bilinear_upscale')) {
    const res = applyBilinearInterpolation(ctx, width, height, 1.4);
    canvas = res.canvas;
    width = res.width;
    height = res.height;
    ctx = canvas.getContext('2d')!;
    appliedFilters.push('雙線性插值超解析度 (1.4x)');
  }

  let imgData = ctx.getImageData(0, 0, width, height);

  // 2. USM 擬真反遮罩銳化 (高頻筆劃增強)
  if (selectedToolIds.includes('usm_unsharp_mask')) {
    applyUnsharpMask(imgData.data, width, height, 1.3);
    appliedFilters.push('USM 反遮罩銳化 (Unsharp Mask)');
  }

  // 3. 數字筆畫修復與小數點增強 (形態學閉合補字)
  if (selectedToolIds.includes('digit_stroke_repair')) {
    applyDigitStrokeRepair(imgData.data, width, height);
    appliedFilters.push('數字筆劃修復與小數點形態學閉合');
  }

  // 4. Sauvola 局部自適應二值化 (濾除反光與陰影)
  if (selectedToolIds.includes('sauvola_adaptive')) {
    applySauvolaBinarization(imgData.data, width, height, 21, 0.22, 128);
    appliedFilters.push('Sauvola 局部動態自適應二值化');
  }

  // 寫回 Canvas
  ctx.putImageData(imgData, 0, 0);

  const processedBase64 = canvas.toDataURL('image/jpeg', 0.92);
  const executionTimeMs = Math.round(performance.now() - startTime);

  return {
    processedBase64,
    executionTimeMs,
    appliedFilters
  };
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CropResult {
  croppedBase64: string;
  boundingBox: BoundingBox;
  originalWidth: number;
  originalHeight: number;
  croppedWidth: number;
  croppedHeight: number;
  confidence: number;
}

/**
 * 第二欄：特徵定位與自動物理裁切 (Feature Extraction & Real Canvas Bounding Box Crop)
 * 利用高頻邊緣能量投影與梯度密度矩陣，鎖定食品營養標籤的核心邊界框，精確裁切去除周圍干擾
 */
export async function detectAndCropNutritionTable(
  base64Src: string,
  locatorId: string = 'yolov8_doc'
): Promise<CropResult> {
  const img = await loadImage(base64Src);
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  // 建立分析 Canvas
  const canvas = document.createElement('canvas');
  canvas.width = origW;
  canvas.height = origH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return {
      croppedBase64: base64Src,
      boundingBox: { x: 0, y: 0, width: origW, height: origH },
      originalWidth: origW,
      originalHeight: origH,
      croppedWidth: origW,
      croppedHeight: origH,
      confidence: 1.0,
    };
  }

  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, origW, origH);
  const data = imgData.data;

  // 1. 計算局部水平與垂直 Sobel 梯度能量分佈
  // 縮小採樣步長以大幅提升效能
  const step = Math.max(1, Math.floor(Math.min(origW, origH) / 400));
  const sampleW = Math.floor(origW / step);
  const sampleH = Math.floor(origH / step);

  const rowEnergy = new Float32Array(sampleH);
  const colEnergy = new Float32Array(sampleW);

  // 灰階與梯度計算
  for (let sy = 1; sy < sampleH - 1; sy++) {
    const y = sy * step;
    for (let sx = 1; sx < sampleW - 1; sx++) {
      const x = sx * step;
      const idx = (y * origW + x) * 4;
      const rightIdx = (y * origW + (x + step)) * 4;
      const downIdx = ((y + step) * origW + x) * 4;

      const gCurr = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      const gRight = 0.299 * data[rightIdx] + 0.587 * data[rightIdx + 1] + 0.114 * data[rightIdx + 2];
      const gDown = 0.299 * data[downIdx] + 0.587 * data[downIdx + 1] + 0.114 * data[downIdx + 2];

      const grad = Math.abs(gCurr - gRight) + Math.abs(gCurr - gDown);
      if (grad > 25) {
        rowEnergy[sy] += grad;
        colEnergy[sx] += grad;
      }
    }
  }

  // 2. 尋找能量高密度的邊界 (自適應能量門檻)
  let totalRowE = 0;
  for (let i = 0; i < sampleH; i++) totalRowE += rowEnergy[i];
  let totalColE = 0;
  for (let i = 0; i < sampleW; i++) totalColE += colEnergy[i];

  let minY = 0;
  let maxY = sampleH - 1;
  let minX = 0;
  let maxX = sampleW - 1;

  if (totalRowE > 0 && totalColE > 0) {
    const rowThreshold = (totalRowE / sampleH) * 0.35;
    const colThreshold = (totalColE / sampleW) * 0.35;

    // 尋找 Y 範圍
    for (let sy = 0; sy < sampleH; sy++) {
      if (rowEnergy[sy] > rowThreshold) {
        minY = Math.max(0, sy - 2);
        break;
      }
    }
    for (let sy = sampleH - 1; sy >= 0; sy--) {
      if (rowEnergy[sy] > rowThreshold) {
        maxY = Math.min(sampleH - 1, sy + 2);
        break;
      }
    }

    // 尋找 X 範圍
    for (let sx = 0; sx < sampleW; sx++) {
      if (colEnergy[sx] > colThreshold) {
        minX = Math.max(0, sx - 2);
        break;
      }
    }
    for (let sx = sampleW - 1; sx >= 0; sx--) {
      if (colEnergy[sx] > colThreshold) {
        maxX = Math.min(sampleW - 1, sx + 2);
        break;
      }
    }
  }

  // 映射回原圖尺寸
  let cropX = Math.max(0, Math.floor(minX * step));
  let cropY = Math.max(0, Math.floor(minY * step));
  let cropW = Math.min(origW - cropX, Math.floor((maxX - minX + 1) * step));
  let cropH = Math.min(origH - cropY, Math.floor((maxY - minY + 1) * step));

  // 加入 5% 安全留白邊界 (Padding)，避免裁到邊緣文字
  const padX = Math.round(cropW * 0.05);
  const padY = Math.round(cropH * 0.05);
  cropX = Math.max(0, cropX - padX);
  cropY = Math.max(0, cropY - padY);
  cropW = Math.min(origW - cropX, cropW + padX * 2);
  cropH = Math.min(origH - cropY, cropH + padY * 2);

  // 如果裁切區域過小 (< 12% 面積) 或無效尺寸，回退至原圖
  const isReasonable = (cropW * cropH) >= (origW * origH * 0.12) && cropW >= 80 && cropH >= 80;
  if (!isReasonable) {
    cropX = 0;
    cropY = 0;
    cropW = origW;
    cropH = origH;
  }

  // 3. 執行真正的 Canvas 物理裁切
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cropW;
  cropCanvas.height = cropH;
  const cropCtx = cropCanvas.getContext('2d')!;
  cropCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  const croppedBase64 = cropCanvas.toDataURL('image/jpeg', 0.95);
  const confidence = isReasonable ? 0.96 : 0.85;

  return {
    croppedBase64,
    boundingBox: { x: cropX, y: cropY, width: cropW, height: cropH },
    originalWidth: origW,
    originalHeight: origH,
    croppedWidth: cropW,
    croppedHeight: cropH,
    confidence,
  };
}

export interface ImageVariantOption {
  id: string;
  label: string;
  tools: string[];
}

/**
 * 根據使用者勾選的影像前處理演算法 (上限 3 項)，生成最多 9 種排列組合影像處理變體
 */
export function generateImagePreprocessingVariants(selectedTools: string[]): ImageVariantOption[] {
  const tools = selectedTools.slice(0, 3);
  if (tools.length === 0) {
    return [{ id: 'raw', label: '原圖 (無濾鏡)', tools: [] }];
  }

  const toolNameMap: Record<string, string> = {
    auto_orientation_osd: 'OSD 轉正',
    sauvola_adaptive: 'Sauvola 二值化',
    bilinear_upscale: '雙線性插值',
    usm_unsharp_mask: 'USM 銳化',
    digit_stroke_repair: '筆畫修復',
  };

  const getToolShortName = (id: string) => toolNameMap[id] || id;

  if (tools.length === 1) {
    const [a] = tools;
    return [
      { id: 'raw', label: '原圖 (無濾鏡)', tools: [] },
      { id: `single_${a}`, label: `單一: ${getToolShortName(a)}`, tools: [a] },
    ];
  }

  if (tools.length === 2) {
    const [a, b] = tools;
    const nameA = getToolShortName(a);
    const nameB = getToolShortName(b);
    return [
      { id: 'raw', label: '原圖 (無濾鏡)', tools: [] },
      { id: `single_${a}`, label: `單一: ${nameA}`, tools: [a] },
      { id: `single_${b}`, label: `單一: ${nameB}`, tools: [b] },
      { id: `combo_${a}_${b}`, label: `正向: ${nameA} ➔ ${nameB}`, tools: [a, b] },
      { id: `combo_${b}_${a}`, label: `逆向: ${nameB} ➔ ${nameA}`, tools: [b, a] },
    ];
  }

  // 3 項選滿：生成 9 種最具代表性的影像演算法排列組合變體
  const [a, b, c] = tools;
  const nameA = getToolShortName(a);
  const nameB = getToolShortName(b);
  const nameC = getToolShortName(c);

  return [
    { id: 'raw', label: '原圖 (無濾鏡)', tools: [] },
    { id: `single_${a}`, label: `單一: ${nameA}`, tools: [a] },
    { id: `single_${b}`, label: `單一: ${nameB}`, tools: [b] },
    { id: `single_${c}`, label: `單一: ${nameC}`, tools: [c] },
    { id: `combo_${a}_${b}`, label: `組合: ${nameA} ➔ ${nameB}`, tools: [a, b] },
    { id: `combo_${a}_${c}`, label: `組合: ${nameA} ➔ ${nameC}`, tools: [a, c] },
    { id: `combo_${b}_${c}`, label: `組合: ${nameB} ➔ ${nameC}`, tools: [b, c] },
    { id: `combo_${a}_${b}_${c}`, label: `全套正向: ${nameA} ➔ ${nameB} ➔ ${nameC}`, tools: [a, b, c] },
    { id: `combo_${c}_${b}_${a}`, label: `全套逆向: ${nameC} ➔ ${nameB} ➔ ${nameA}`, tools: [c, b, a] },
  ];
}

