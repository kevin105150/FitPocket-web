import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// Helper to get GoogleGenAI client
function getGenAI(customKey?: string): GoogleGenAI | null {
  const apiKey = (customKey && customKey.trim().length > 10)
    ? customKey.trim()
    : process.env.GEMINI_API_KEY;

  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
}

// 1. API Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 2. Gemini Text Nutrition Estimation
app.post('/api/ai/estimate-nutrition', async (req, res) => {
  try {
    const { query, customApiKey } = req.body;
    if (!query) {
      return res.status(400).json({ error: '請輸入飲食名稱' });
    }

    const ai = getGenAI(customApiKey);
    if (!ai) {
      // Fallback rule-based estimate if no API key configured
      return res.json({
        name: query,
        caloriesPer100g: 150,
        carbsPer100g: 15,
        proteinPer100g: 10,
        fatPer100g: 5,
        sugarsPer100g: 2,
        fiberPer100g: 1.5,
        sodiumPer100g: 250,
        potassiumPer100g: 180,
        defaultServingAmount: 100,
        servingUnit: 'g',
        servingSizeText: '1份 (約100g)',
        explanation: '系統預設估算（可於設定頁面填入 Gemini API 金鑰啟用智慧分析）',
      });
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text || '';
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    res.json(parsed);
  } catch (error: any) {
    console.error('Gemini estimate error:', error);
    res.status(500).json({ error: error.message || 'AI 辨識失敗' });
  }
});

// 3. Gemini Image Food Recognition
app.post('/api/ai/estimate-image', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', customApiKey } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: '未提供圖片資料' });
    }

    const ai = getGenAI(customApiKey);
    if (!ai) {
      return res.status(400).json({
        error: '請先在「設定」中配置 GEMINI_API_KEY 以啟用圖片辨識功能',
      });
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType,
              },
            },
          ],
        },
      ],
    });

    const text = response.text || '';
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    res.json(parsed);
  } catch (error: any) {
    console.error('Gemini image analyze error:', error);
    res.status(500).json({ error: error.message || '圖片辨識失敗' });
  }
});

// 4. Gemini Workout Recommendations
app.post('/api/ai/workout-suggest', async (req, res) => {
  try {
    const { bodyPart, customApiKey } = req.body;
    const ai = getGenAI(customApiKey);

    if (!ai) {
      // Fallback
      return res.json({
        exercises: ['標準俯臥撐', '啞鈴推舉', '彈力帶夾胸', '棒式支撐'],
      });
    }

    const prompt = `使用者想針對「${bodyPart || '全身'}」肌群進行健身訓練。
請推薦 4 到 6 個最有效、循序漸進的經典健身動作名稱。
請嚴格輸出 JSON 陣列，例如 ["動作1", "動作2", "動作3", "動作4"]，不要輸出其他文字或 markdown。`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text || '';
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);
    res.json({ exercises: Array.isArray(parsed) ? parsed : [] });
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
