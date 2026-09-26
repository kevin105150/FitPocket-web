/**
 * 優化圖片：自動修正手機相機 EXIF 旋轉方向、進行等比例高解析度壓縮，確保 Gemini 視覺辨識清晰度
 */
export async function optimizeImageForAi(
  base64: string,
  maxWidth = 1280,
  maxHeight = 1280,
  quality = 0.85
): Promise<string> {
  const dataUrl = base64.startsWith('data:')
    ? base64
    : `data:image/jpeg;base64,${base64}`;

  try {
    // 1. 將 Data URL 轉為 Blob 以便使用 createImageBitmap 校正 EXIF 旋轉
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    let width = 0;
    let height = 0;
    let imageSource: CanvasImageSource | null = null;

    // 2. 使用現代瀏覽器 createImageBitmap 搭配 imageOrientation: 'from-image' 自動旋轉正向
    if (typeof createImageBitmap === 'function') {
      try {
        const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
        width = bitmap.width;
        height = bitmap.height;
        imageSource = bitmap;
      } catch (bitmapErr) {
        console.warn('[ImageOptimizer] createImageBitmap 失敗，降級使用 HTMLImageElement:', bitmapErr);
      }
    }

    // 3. 若 createImageBitmap 不支援或失敗，降級為傳統 HTMLImageElement
    if (!imageSource) {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const tempImg = new Image();
        tempImg.onload = () => resolve(tempImg);
        tempImg.onerror = reject;
        tempImg.src = dataUrl;
      });
      width = img.width;
      height = img.height;
      imageSource = img;
    }

    if (!width || !height) {
      return dataUrl;
    }

    // 4. 計算等比例縮放尺寸，確保最佳辨識清晰度 (1280px / 0.85 品質)
    let targetWidth = width;
    let targetHeight = height;

    if (targetWidth > maxWidth || targetHeight > maxHeight) {
      const widthRatio = maxWidth / targetWidth;
      const heightRatio = maxHeight / targetHeight;
      const bestRatio = Math.min(widthRatio, heightRatio);

      targetWidth = Math.round(targetWidth * bestRatio);
      targetHeight = Math.round(targetHeight * bestRatio);
    }

    // 5. 繪製至 Canvas 並導出高品質 JPEG
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(imageSource, 0, 0, targetWidth, targetHeight);

    // 釋放 ImageBitmap 記憶體
    if (imageSource && 'close' in imageSource && typeof (imageSource as any).close === 'function') {
      (imageSource as any).close();
    }

    return canvas.toDataURL('image/jpeg', quality);
  } catch (err) {
    console.warn('[ImageOptimizer] 圖片優化過程發生非致命錯誤，回傳原始圖片:', err);
    return dataUrl;
  }
}
