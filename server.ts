import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = 3000;

// First-party Firebase OAuth proxy (bypasses mobile browser third-party cookie restrictions)
app.use('/__/auth', createProxyMiddleware({
  target: 'https://quirky-gear-l0w9t.firebaseapp.com',
  changeOrigin: true,
}));

app.use(express.json({ limit: '15mb' }));

// Helper to get GoogleGenAI client (Prefers custom key, falls back to server env key)
function getGenAI(customKey?: string): GoogleGenAI | null {
  const apiKey = (customKey && typeof customKey === 'string' && customKey.trim().length > 10)
    ? customKey.trim()
    : process.env.GEMINI_API_KEY;

  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Multi-model fallback runner to guarantee 100% uptime against 503 (high demand) or 429 (quota)
async function generateWithFallback(
  ai: GoogleGenAI,
  preferredModel: string,
  contents: any
): Promise<{ text: string; modelUsed: string }> {
  // Ordered cascade: preferred model -> 3.6-flash -> 3.5-flash -> 3.1-flash-lite
  const candidateModels = Array.from(
    new Set([
      preferredModel || 'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
    ])
  );

  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      console.log(`[Gemini Request] Attempting model: ${model}...`);
      const response = await ai.models.generateContent({
        model,
        contents,
      });

      const text = response.text;
      if (text && text.trim().length > 0) {
        console.log(`[Gemini Success] Successfully generated with ${model}`);
        return { text: text.trim(), modelUsed: model };
      }
    } catch (err: any) {
      lastError = err;
      const status = err.status || err.code || 0;
      const message = err.message || '';
      console.warn(`[Gemini Fallback] Model ${model} returned ${status}: ${message.slice(0, 120)}`);

      // If it's a transient server issue (503, 429, 500), immediately try the next model
      if (
        status === 503 ||
        status === 429 ||
        status === 500 ||
        message.includes('high demand') ||
        message.includes('UNAVAILABLE') ||
        message.includes('RESOURCE_EXHAUSTED')
      ) {
        continue;
      }

      // If it's not a quota/demand issue, still attempt fallback to ensure user doesn't get blocked
      continue;
    }
  }

  throw lastError || new Error('所有可用 AI 模型目前服務繁忙，請稍後再試。');
}

// Helper to extract JSON from AI response text
function extractJsonFromText(rawText: string): any {
  const jsonMatch =
    rawText.match(/```json\s*([\s\S]*?)\s*```/) ||
    rawText.match(/```\s*([\s\S]*?)\s*```/) ||
    rawText.match(/([\{\[][\s\S]*[\}\]])/);

  if (!jsonMatch) {
    throw new Error('AI 回傳資料格式有誤，未能成功提取 JSON');
  }

  const clean = jsonMatch[1].trim();
  return JSON.parse(clean);
}

// 1. API Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 1.1 Test AI Connection & Model Latency
app.all('/api/ai/test-connection', async (req, res) => {
  const startTime = Date.now();
  try {
    const customKey = req.body?.customApiKey || (req.query?.customApiKey as string);
    const model = req.body?.model || (req.query?.model as string) || 'gemini-3.8-flash';

    const ai = getGenAI(customKey);
    if (!ai) {
      return res.status(401).json({ 
        ok: false, 
        error: '未偵測到 Gemini API 金鑰。請於設定頁面輸入金鑰，或確認伺服器環境變數。' 
      });
    }

    const { text, modelUsed } = await generateWithFallback(
      ai,
      model,
      '請回覆：「連線成功」'
    );

    const latencyMs = Date.now() - startTime;
    res.json({
      ok: true,
      message: 'Gemini AI API 通訊完全正常！',
      modelUsed,
      requestedModel: model,
      sampleResponse: text,
      latencyMs,
    });
  } catch (error: any) {
    console.error('Test connection error:', error);
    res.status(500).json({
      ok: false,
      error: error.message || '測試連線失敗',
      latencyMs: Date.now() - startTime,
    });
  }
});

// 2. Gemini Text Nutrition Estimation
app.post('/api/ai/estimate-nutrition', async (req, res) => {
  try {
    const { query, customApiKey, model } = req.body;
    if (!query) {
      return res.status(400).json({ error: '請輸入飲食名稱' });
    }

    const ai = getGenAI(customApiKey);
    if (!ai) {
      return res.status(401).json({ error: '尚未設定 Gemini API Key。請至「設定」頁面輸入您的 API 金鑰以使用 AI 智慧估算。' });
    }

    const prompt = `你是一位專業的台灣飲食營養師。使用者輸入了一道食物：「${query}」。
請詳細估算此食物每一百公克 (per 100g) 的營養成分以及常見單次食用份量。
請嚴格輸出合法 JSON 格式（不要使用 markdown 程式碼區塊標記，只輸出純 JSON 物件）：
{
  "name": "食物標準名稱",
  "caloriesPer100g": 數字(大卡),
  "carbsPer100g": 數字(公克),
  "proteinPer100g": 數字(公克),
  "fatPer100g": 數字(公克),
  "sugarsPer100g": 數字(公克),
  "fiberPer100g": 數字(公克),
  "sodiumPer100g": 數字(毫克),
  "potassiumPer100g": 數字(毫克),
  "defaultServingAmount": 數字(該份量的公克數，例如150),
  "servingUnit": "g",
  "servingSizeText": "常見份量說明 (例如: 1碗 約160g)",
  "explanation": "營養師簡評與健康建議 (50字以內)"
}`;

    const { text, modelUsed } = await generateWithFallback(
      ai,
      model || 'gemini-3.8-flash',
      prompt
    );

    const parsed = extractJsonFromText(text);
    parsed._modelUsed = modelUsed;
    res.json(parsed);
  } catch (error: any) {
    console.error('Gemini estimate error:', error);
    const status = error.status || 500;
    res.status(status).json({ 
      error: error.message || 'AI 辨識失敗',
      status: status
    });
  }
});

// 3. Gemini Image Food Recognition
app.post('/api/ai/estimate-image', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', customApiKey, model } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: '未提供圖片資料' });
    }

    const ai = getGenAI(customApiKey);
    if (!ai) {
      return res.status(401).json({ error: '尚未設定 Gemini API Key。請至「設定」頁面輸入您的 API 金鑰以使用 AI 視覺辨識功能。' });
    }

    const prompt = `請辨識這張照片中的食物或料理。請估算其食物名稱、每 100g 的營養素，以及這張照片中這道菜的總估計份量與熱量。
請嚴格輸出純 JSON 物件（不要包含任何 markdown 區塊反引號）：
{
  "name": "辨識出的食物名稱",
  "caloriesPer100g": 數字(大卡),
  "carbsPer100g": 數字(公克),
  "proteinPer100g": 數字(公克),
  "fatPer100g": 數字(公克),
  "sugarsPer100g": 數字(公克),
  "fiberPer100g": 數字(公克),
  "sodiumPer100g": 數字(毫克),
  "potassiumPer100g": 數字(毫克),
  "defaultServingAmount": 數字(此份照片目測總公克數),
  "servingUnit": "g",
  "servingSizeText": "照片目測份量說明 (例如: 1盤 約250g)",
  "explanation": "食材分析與建議"
}`;

    // Strip prefix if user passed full data URI
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const contents = [
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
    ];

    const { text, modelUsed } = await generateWithFallback(
      ai,
      model || 'gemini-3.8-flash',
      contents
    );

    const parsed = extractJsonFromText(text);
    parsed._modelUsed = modelUsed;
    res.json(parsed);
  } catch (error: any) {
    console.error('Gemini image analyze error:', error);
    const status = error.status || 500;
    res.status(status).json({ 
      error: error.message || '圖片辨識失敗',
      status: status
    });
  }
});

// 4. Gemini Workout Recommendations
app.post('/api/ai/workout-suggest', async (req, res) => {
  try {
    const { bodyPart, customApiKey, model } = req.body;
    const ai = getGenAI(customApiKey);

    if (!ai) {
      return res.json({
        exercises: ['標準俯臥撐', '啞鈴推舉', '彈力帶夾胸', '棒式支撐'],
      });
    }

    const prompt = `使用者想針對「${bodyPart || '全身'}」肌群進行健身訓練。
請推薦 4 到 6 個最有效、循序漸進的經典健身動作名稱。
請嚴格輸出 JSON 陣列，例如 ["動作1", "動作2", "動作3", "動作4"]，不要輸出其他文字或 markdown。`;

    const { text } = await generateWithFallback(
      ai,
      model || 'gemini-3.8-flash',
      prompt
    );

    try {
      const parsed = extractJsonFromText(text);
      res.json({ exercises: Array.isArray(parsed) ? parsed : ['慢跑', '棒式', '深蹲', '伏地挺身'] });
    } catch {
      res.json({ exercises: ['慢跑', '棒式', '深蹲', '伏地挺身'] });
    }
  } catch (error: any) {
    console.error('Workout suggest error:', error);
    res.json({ exercises: ['慢跑', '棒式', '深蹲', '伏地挺身'] });
  }
});

// 5. Open Food Facts proxy
app.get('/api/openfoodfacts/search', async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query) return res.json({ products: [] });

    const url = `https://tw.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      query
    )}&search_simple=1&action=process&json=1&page_size=25`;

    const fetchRes = await fetch(url, {
      headers: {
        'User-Agent': 'FitPocketWeb - Version 1.0 - www.fitpocket.app',
      },
    });

    if (!fetchRes.ok) {
      return res.json({ products: [] });
    }

    const data: any = await fetchRes.json();
    const products = (data.products || []).map((p: any) => ({
      id: `off_${p.code || Math.random()}`,
      name: p.product_name || p.product_name_zh || '未知商品',
      brand: p.brands || '',
      caloriesPer100g: parseFloat(p.nutriments?.['energy-kcal_100g'] || 0),
      carbsPer100g: parseFloat(p.nutriments?.carbohydrates_100g || 0),
      sugarsPer100g: parseFloat(p.nutriments?.sugars_100g || 0),
      fiberPer100g: parseFloat(p.nutriments?.fiber_100g || 0),
      proteinPer100g: parseFloat(p.nutriments?.proteins_100g || 0),
      fatPer100g: parseFloat(p.nutriments?.fat_100g || 0),
      sodiumPer100g: parseFloat(p.nutriments?.sodium_100g || 0) * 1000,
      potassiumPer100g: parseFloat(p.nutriments?.potassium_100g || 0) * 1000,
      defaultServingAmount: parseFloat(p.serving_quantity || 100),
      servingUnit: 'g',
      servingSizeText: p.serving_size || '1份 (100g)',
      imageUrl: p.image_front_small_url || p.image_url,
      barcode: p.code,
    }));

    res.json({ products });
  } catch (error: any) {
    console.error('OpenFoodFacts proxy error:', error);
    res.json({ products: [] });
  }
});

// 6. Open Food Facts barcode proxy
app.get('/api/openfoodfacts/barcode/:code', async (req, res) => {
  try {
    const code = req.params.code;
    const url = `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(code)}.json`;

    const fetchRes = await fetch(url, {
      headers: {
        'User-Agent': 'FitPocketWeb - Version 1.0',
      },
    });

    if (!fetchRes.ok) {
      return res.status(404).json({ error: '查無此商品條碼' });
    }

    const data: any = await fetchRes.json();
    if (data.status !== 1 || !data.product) {
      return res.status(404).json({ error: '未在 Open Food Facts 找到此商品' });
    }

    const p = data.product;
    const product = {
      id: `off_${p.code}`,
      name: p.product_name || p.product_name_zh || '未知商品',
      brand: p.brands || '',
      caloriesPer100g: parseFloat(p.nutriments?.['energy-kcal_100g'] || 0),
      carbsPer100g: parseFloat(p.nutriments?.carbohydrates_100g || 0),
      sugarsPer100g: parseFloat(p.nutriments?.sugars_100g || 0),
      fiberPer100g: parseFloat(p.nutriments?.fiber_100g || 0),
      proteinPer100g: parseFloat(p.nutriments?.proteins_100g || 0),
      fatPer100g: parseFloat(p.nutriments?.fat_100g || 0),
      sodiumPer100g: parseFloat(p.nutriments?.sodium_100g || 0) * 1000,
      potassiumPer100g: parseFloat(p.nutriments?.potassium_100g || 0) * 1000,
      defaultServingAmount: parseFloat(p.serving_quantity || 100),
      servingUnit: 'g',
      servingSizeText: p.serving_size || '1份 (100g)',
      imageUrl: p.image_front_small_url || p.image_url,
      barcode: p.code,
    };

    res.json({ product });
  } catch (error: any) {
    console.error('Barcode lookup error:', error);
    res.status(500).json({ error: '條碼查詢服務異常' });
  }
});

// 7. Serve root static files explicitly (apk.html and DietApp.part*)
app.get('/apk.html', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'apk.html'));
});

app.get('/DietApp.part*', (req, res) => {
  const file = path.basename(req.path);
  const filePath = path.join(process.cwd(), file);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.sendFile(filePath);
});

// Vite middleware in dev or static serving in production
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FitPocket Server running on http://0.0.0.0:${PORT}`);
  });
}

start();
