import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// First-party Firebase OAuth proxy (bypasses mobile browser third-party cookie restrictions)
app.use('/__/auth', createProxyMiddleware({
  target: 'https://quirky-gear-l0w9t.firebaseapp.com/__/auth',
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

// Multi-model fallback runner to guarantee uptime within the Gemini 3.x family
async function generateWithFallback(
  ai: GoogleGenAI,
  preferredModel: string,
  contents: any,
  useSearch = false
): Promise<{ text: string; modelUsed: string }> {
  // STRICTLY Gemini 3.x models only as per AGENTS.md
  const candidateModels = Array.from(
    new Set([
      preferredModel,
      'gemini-3.8-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
    ].filter(m => m && m.startsWith('gemini-3.')))
  );

  let lastError: any = null;

  for (const modelName of candidateModels) {
    try {
      console.log(`[Gemini Request] Attempting model: ${modelName} (Search: ${useSearch})...`);
      
      const config: any = {
        model: modelName,
        contents: Array.isArray(contents) ? contents : [{ role: 'user', parts: [{ text: contents }] }],
      };

      if (useSearch) {
        config.tools = [{ googleSearch: {} }];
      }

      const response = await ai.models.generateContent(config);

      const text = response.text;
      if (text && text.trim().length > 0) {
        console.log(`[Gemini Success] Successfully generated with ${modelName}`);
        return { text: text.trim(), modelUsed: modelName };
      }
    } catch (err: any) {
      lastError = err;
      const status = err.status || err.code || 0;
      const message = err.message || '';
      console.warn(`[Gemini Fallback] Model ${modelName} returned ${status}: ${message.slice(0, 120)}`);

      // If it's a transient server issue (503, 429, 500), try the next 3.x model
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

      // Continue to next 3.x model for any error to maximize success rate within the family
      continue;
    }
  }

  throw new Error('AI 伺服器目前忙碌中或需求過大，請稍後重試。');
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

// Server-side normalization for 4 major Taiwan convenience stores
function normalizeConvenienceStoreBrand(brandName?: string): string {
  const b = (brandName || '').trim();
  if (!b) return '';

  if (/^(7-?11|7-?eleven|seven(-?eleven)?|統一超商|小七|711)$/i.test(b) || /7-?eleven/i.test(b) || /統一超商/.test(b)) {
    return '7-11';
  }
  if (/^(全家(便利商店)?|familymart)$/i.test(b) || /全家便利商店/.test(b) || /familymart/i.test(b)) {
    return '全家';
  }
  if (/^(萊爾富(便利商店)?|hi-?life)$/i.test(b) || /萊爾富/.test(b) || /hi-?life/i.test(b)) {
    return '萊爾富';
  }
  if (/^(ok(超商|便利商店|mart|·mart)?)$/i.test(b) || /ok(超商|mart|·mart)/i.test(b)) {
    return 'OK';
  }
  return b;
}

// 1. API Health
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 1.2 Test Firebase Firestore Connection
app.all('/api/firebase/test-connection', async (req, res) => {
  const startTime = Date.now();
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    const fsConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const dbId = fsConfig.firestoreDatabaseId || '(default)';
    const testDocId = `srv_diag_${Date.now()}`;
    const restUrl = `https://firestore.googleapis.com/v1/projects/${fsConfig.projectId}/databases/${dbId}/documents/_connection_test/${testDocId}?key=${fsConfig.apiKey}`;

    // Write test
    const writeRes = await fetch(restUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          ping: { stringValue: 'server_pong' },
          timestamp: { integerValue: String(Date.now()) },
          target: { stringValue: dbId },
        },
      }),
    });

    if (!writeRes.ok) {
      const err = await writeRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${writeRes.status}: 寫入測試失敗`);
    }

    // Read test
    const readRes = await fetch(restUrl);
    if (!readRes.ok) {
      const err = await readRes.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${readRes.status}: 讀取測試失敗`);
    }

    // Delete test
    fetch(restUrl, { method: 'DELETE' }).catch(() => {});

    const latencyMs = Date.now() - startTime;
    res.json({
      success: true,
      latencyMs,
      message: `Firebase Firestore 伺服器與雲端通訊正常！反應時間: ${latencyMs}ms`,
      details: {
        projectId: fsConfig.projectId,
        databaseId: dbId,
        protocol: 'HTTPS REST / Firestore v1 API',
      },
    });
  } catch (error: any) {
    console.error('Firebase test connection error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Firebase 連線失敗',
      latencyMs: Date.now() - startTime,
    });
  }
});

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
請使用 Google 搜尋工具查找該食物（特別是連鎖品牌如 7-11、全家、麥當勞、摩斯等）的官方營養資訊。
請詳細估算或抓取此食物每一百公克 (per 100g) 的營養成分。
特別注意：
1. 品牌 (brand)：
- 若使用者輸入有明確提及品牌、店家或超商（例如：義美、光泉、7-11、全家、星巴克、摩斯、麥當勞等），請辨識並填寫該品牌名稱。如果是 4 大超商請標準化為 7-11、全家、萊爾富、OK。
- 若未提及任何品牌（例如純食物名稱「白飯」、「地瓜」、「茶葉蛋」），請務必填寫 "" (空字串)。
2. 對於「預設份量」 (defaultServingAmount)：
- 必須是常見的「單一份量」(例如 1 份 約 180g)，回傳 180。
- 請嚴格遵守此單份份量原則。
3. 單位 (servingUnit)：飲品必填 ml，固體填 g。

請優先使用搜尋工具獲取真實數據。
請嚴格輸出合法 JSON 格式：
{
  "name": "食物標準名稱",
  "brand": "品牌名稱",
  "caloriesPer100g": 數字(大卡),
  "carbsPer100g": 數字(公克),
  "proteinPer100g": 數字(公克),
  "fatPer100g": 數字(公克),
  "sugarsPer100g": 數字(公克),
  "fiberPer100g": 數字(公克),
  "sodiumPer100g": 數字(毫克),
  "potassiumPer100g": 數字(毫克),
  "defaultServingAmount": 數字,
  "servingUnit": "g 或 ml",
  "servingSizeText": "單份份量說明 (例如: 1份 約180g)",
  "explanation": "營養師簡評與健康建議 (50字以內)"
}`;

    const { text, modelUsed } = await generateWithFallback(
      ai,
      model || 'gemini-3.8-flash',
      prompt,
      true // Enable Search Grounding
    );

    const parsed = extractJsonFromText(text);
    if (parsed.brand) {
      parsed.brand = normalizeConvenienceStoreBrand(parsed.brand);
    }
    if (!parsed.brand || !String(parsed.brand).trim()) {
      parsed.brand = 'AI辨識';
    }
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

    const prompt = `請仔細辨識這張照片中的食物、商品包裝或料理。
特別注意：
1. 品牌 (brand)：若包裝或畫面中有標籤、超商、品牌商標或店名，請務必辨識出來。如果是台灣 4 大超商，請嚴格按照以下標準超商名稱填寫：
   - 統一超商 / 7-11 / 7-Eleven / 小七 -> "7-11"
   - 全家 / FamilyMart -> "全家"
   - 萊爾富 / Hi-Life -> "萊爾富"
   - OK超商 / OKmart -> "OK"
   若為其他品牌（例如：義美、光泉、好市多、麥當勞等）請填寫該品牌；若無品牌純自製料理請填 ""。
2. 條碼 (barcode)：若照片中有商品國際條碼 (EAN-13, UPC 等數字)，請辨識並填寫其數字字串；若無或看不清楚請填 ""。
3. 營養成分：請估算每 100g 的各項營養素。若畫面中有營養標示表格，請優先參考其數據。
4. 份量判定：若為商品包裝，請優先以營養標示上的「一份 (serving)」為基準回傳 defaultServingAmount，絕對不可回傳整包裝的總重，也不可乘以包裝總份數。
   - 核心原則：使用者希望紀錄「單純一份」的營養，而非整個包裝袋的總合。
   - 例如：若包裝標示「本包裝含 6 份，每份 180g」，你的 defaultServingAmount 必須回傳 180，絕對不可回傳 180 * 6 = 1080！
   - 若為散裝料理（如餐廳飯菜），則以目測單次食用的一份重量為準。
5. 生鮮海鮮與純肉類特別提醒（如：生魚片、刺身、鮭魚/鮪魚生魚片、純海鮮、無調味煎牛肉/雞肉）：
   - 若畫面為純生魚片、刺身（無壽司米飯），其碳水化合物 (carbsPer100g) 與糖 (sugarsPer100g) 必須標示為 0！
   - 切勿將純生魚片（刺身）誤認為含有醋飯的握壽司而估算碳水！

請嚴格輸出純 JSON 物件（不要包含 any markdown 區塊反引號）：
{
  "name": "辨識出的食物品名 (例如: 經典茶葉蛋、原味優格)",
  "brand": "辨識到的品牌 (4大超商請填 7-11、全家、萊爾富、OK；無品牌填空字串)",
  "barcode": "商品條碼數字 (無則填空字串)",
  "caloriesPer100g": 數字(大卡),
  "carbsPer100g": 數字(公克),
  "proteinPer100g": 數字(公克),
  "fatPer100g": 數字(公克),
  "sugarsPer100g": 數字(公克),
  "fiberPer100g": 數字(公克),
  "sodiumPer100g": 數字(毫克),
  "potassiumPer100g": 數字(毫克),
  "defaultServingAmount": 數字(單份基準數值，例如 180，如果是液體則是毫升數如 300，絕對不要回傳整包總重或乘以份數的總重),
  "servingUnit": "食品或飲料的基準單位：如果是液體、湯品、飲料、牛奶、咖啡、優酪乳等，請務必填寫 'ml'；固體食品填寫 'g'；亦可依合適度填寫 '個'、'瓶'、'杯'、'包'、'份' 等（例如液體應精準判斷為 'ml' 而非 'g'）",
  "servingSizeText": "單份份量說明 (例如: 1份 約180g，或 1瓶 約350ml)",
  "explanation": "食材分析、品牌與建議"
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
      contents,
      true // Enable Search Grounding for product data enrichment
    );

    const parsed = extractJsonFromText(text);
    if (parsed.brand) {
      parsed.brand = normalizeConvenienceStoreBrand(parsed.brand);
    }
    if (!parsed.brand || !String(parsed.brand).trim()) {
      parsed.brand = 'AI辨識';
    }
    if (parsed.barcode) {
      parsed.barcode = String(parsed.barcode).trim();
    }
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

// 3.5. FamilyMart Direct API Scraper Search
app.post('/api/family/search', async (req, res) => {
  try {
    const { keyword } = req.body;
    const searchKeyword = (keyword || '').trim();

    const listResp = await fetch('https://foodsafety.family.com.tw/Web_FFD_2022/ws/QueryFsProductListByFilter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://foodsafety.family.com.tw/Web_FFD_2022/'
      },
      body: JSON.stringify({ MEMBER: 'N', KEYWORD: searchKeyword })
    });

    if (!listResp.ok) {
      throw new Error('無法連線至全家食安查詢服務');
    }

    const listData = await listResp.json();
    if (listData.RESULT_CODE !== '00' || !Array.isArray(listData.LIST)) {
      return res.json({ products: [] });
    }

    const allItems: any[] = [];
    for (const cat of listData.LIST) {
      if (Array.isArray(cat.ITEM)) {
        for (const item of cat.ITEM) {
          allItems.push(item);
        }
      }
    }

    const selectedItems = allItems.slice(0, 12);
    
    // Parallelize detail fetching for better performance and to avoid timeouts
    const productPromises = selectedItems.map(async (item: any) => {
      try {
        const detailResp = await fetch('https://foodsafety.family.com.tw/Web_FFD_2022/ws/QueryFsProductByItem', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Referer': 'https://foodsafety.family.com.tw/Web_FFD_2022/'
          },
          body: JSON.stringify({ MEMBER: 'N', CMNO: item.CMNO })
        });

        if (detailResp.ok) {
          const detailData = await detailResp.json();
          if (detailData.RESULT_CODE === '00' && Array.isArray(detailData.LIST) && detailData.LIST.length > 0) {
            const d = detailData.LIST[0];
            const nut = (d.NUTRIENTS && d.NUTRIENTS[0]) || {};
            
            let calories = 0;
            const noteStr = d.NOTE || item.NOTE || '';
            const calMatch = noteStr.match(/熱量\s*([0-9\.]+)\s*大卡/);
            if (calMatch) {
              calories = parseFloat(calMatch[1]);
            } else if (nut.CALORIES) {
              calories = nut.CALORIES;
            } else {
              calories = 200;
            }

            let servingAmount = 1;
            let servingUnit = '份';
            if (noteStr) {
              const specMatch = noteStr.match(/(?:規格|每份規格)\s*([0-9\.]+)\s*(公克|克|g|G|毫升|ml|ML)/) || noteStr.match(/([0-9\.]+)\s*(公克|克|g|G|毫升|ml|ML)/);
              if (specMatch) {
                servingAmount = parseFloat(specMatch[1]);
                const u = specMatch[2].toLowerCase();
                if (u.includes('公克') || u.includes('克') || u === 'g') {
                  servingUnit = 'g';
                } else if (u.includes('毫升') || u === 'ml') {
                  servingUnit = 'ml';
                } else {
                  servingUnit = specMatch[2];
                }
              }
            }

            return {
              id: `family_${d.CMNO || Date.now()}`,
              name: d.PRODNAME || item.PRODNAME,
              brand: '全家',
              calories: calories,
              carbs: nut.CARBOHYDRATE || 0,
              protein: nut.PROTEIN || 0,
              fat: nut.TOTALFAT || 0,
              sugars: nut.SUGAR || 0,
              fiber: 0,
              sodium: nut.SODIUM || 0,
              potassium: 0,
              servingAmount: servingAmount,
              servingUnit: servingUnit,
              servingSizeText: noteStr || '1份',
              imageUrl: d.PROD_PIC ? `https://foodsafety.family.com.tw/product_img/${d.PROD_PIC}` : undefined,
              isUserCustom: false
            };
          }
        }
      } catch (err) {
        console.warn(`Error fetching details for item ${item.CMNO}:`, err);
      }
      return null;
    });

    const results = await Promise.all(productPromises);
    const products = results.filter(p => p !== null);

    res.json({ products });
  } catch (error: any) {
    console.error('Family search error:', error);
    res.status(500).json({ error: error.message || '全家搜尋發生錯誤' });
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
