import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { createProxyMiddleware } from 'http-proxy-middleware';
import * as cheerio from 'cheerio';

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// First-party Firebase OAuth proxy (bypasses mobile browser third-party cookie restrictions)
app.use('/__/auth', createProxyMiddleware({
  target: 'https://quirky-gear-l0w9t.firebaseapp.com/__/auth',
  changeOrigin: true,
}));

app.use(express.json({ limit: '15mb' }));

const ADMIN_EMAIL = 'kevin10611@gmail.com';

// Helper to get GoogleGenAI client
function getGenAIClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getFirestoreConfig() {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const fsConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return {
        projectId: fsConfig.projectId || 'quirky-gear-l0w9t',
        databaseId: fsConfig.firestoreDatabaseId || 'ai-studio-aidiettrackerapp-767063f9-4fee-46bc-9161-8aaabc23bda9',
        apiKey: fsConfig.apiKey || '',
      };
    }
  } catch (e) {
    console.error('Error reading firebase config:', e);
  }
  return {
    projectId: 'quirky-gear-l0w9t',
    databaseId: 'ai-studio-aidiettrackerapp-767063f9-4fee-46bc-9161-8aaabc23bda9',
    apiKey: '',
  };
}

// Google Gemini daily quota resets at 00:00:00 Pacific Time
function getServerGoogleApiQuotaCycleDate(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date); // "YYYY-MM-DD"
  } catch {
    const ptDate = new Date(date.getTime() - 7 * 60 * 60 * 1000);
    return ptDate.toISOString().slice(0, 10);
  }
}

function parseFirestoreDoc(doc: any) {
  if (!doc || !doc.fields) return null;
  const res: any = {};
  const nameParts = (doc.name || '').split('/');
  res.id = nameParts[nameParts.length - 1];
  for (const [key, val] of Object.entries<any>(doc.fields)) {
    if ('stringValue' in val) res[key] = val.stringValue;
    else if ('integerValue' in val) res[key] = parseInt(val.integerValue, 10);
    else if ('doubleValue' in val) res[key] = parseFloat(val.doubleValue);
    else if ('booleanValue' in val) res[key] = val.booleanValue;
    else if ('nullValue' in val) res[key] = null;
    else if ('arrayValue' in val) {
      res[key] = (val.arrayValue?.values || []).map((v: any) => {
        if ('stringValue' in v) return v.stringValue;
        if ('integerValue' in v) return parseInt(v.integerValue, 10);
        return v;
      });
    }
  }
  return res;
}

function toFirestoreFields(obj: any) {
  const fields: any = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'id') continue;
    if (val === null || val === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof val === 'string') {
      fields[key] = { stringValue: val };
    } else if (typeof val === 'number') {
      if (Number.isInteger(val)) {
        fields[key] = { integerValue: String(val) };
      } else {
        fields[key] = { doubleValue: val };
      }
    } else if (typeof val === 'boolean') {
      fields[key] = { booleanValue: val };
    } else if (Array.isArray(val)) {
      fields[key] = {
        arrayValue: {
          values: val.map((v) => ({ stringValue: String(v) })),
        },
      };
    }
  }
  return fields;
}

function normalizeEmail(email: string): string {
  return (email || '').trim().toLowerCase();
}

function getDocIdForEmail(email: string): string {
  return encodeURIComponent(normalizeEmail(email));
}

async function getWhitelistUserFromFirestore(email: string): Promise<any | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const cfg = getFirestoreConfig();
  const docId = getDocIdForEmail(normalized);
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.databaseId}/documents/ai_whitelist/${docId}?key=${cfg.apiKey}`;

  try {
    const resp = await fetch(url);
    if (resp.status === 404) return null;
    if (!resp.ok) {
      const err = await resp.text();
      console.warn('Error fetching whitelist user:', err);
      return null;
    }
    const data = await resp.json();
    return parseFirestoreDoc(data);
  } catch (err) {
    console.error('Fetch whitelist error:', err);
    return null;
  }
}

async function saveWhitelistUserToFirestore(userData: any): Promise<any> {
  const normalized = normalizeEmail(userData.email);
  const cfg = getFirestoreConfig();
  const docId = getDocIdForEmail(normalized);
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.databaseId}/documents/ai_whitelist/${docId}?key=${cfg.apiKey}`;

  const fields = toFirestoreFields(userData);
  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Failed to save whitelist entry: ${errText}`);
  }
  const data = await resp.json();
  return parseFirestoreDoc(data);
}

async function getAllWhitelistUsers(): Promise<any[]> {
  const cfg = getFirestoreConfig();
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.databaseId}/documents:runQuery?key=${cfg.apiKey}`;

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'ai_whitelist' }]
        }
      })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.warn('Error querying whitelist:', errText);
      return [];
    }
    const data = await resp.json();
    const docs = (data || [])
      .map((item: any) => item.document)
      .filter(Boolean);
    return docs.map(parseFirestoreDoc).filter(Boolean);
  } catch (err) {
    console.error('List whitelist query error:', err);
    return [];
  }
}

async function deleteWhitelistUser(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email);
  const cfg = getFirestoreConfig();
  const docId = getDocIdForEmail(normalized);
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.databaseId}/documents/ai_whitelist/${docId}?key=${cfg.apiKey}`;

  try {
    const resp = await fetch(url, { method: 'DELETE' });
    return resp.ok;
  } catch (err) {
    console.error('Delete whitelist error:', err);
    return false;
  }
}

async function recordDailyUsageHistory(email: string, tokens: number) {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  const cfg = getFirestoreConfig();
  const date = getServerGoogleApiQuotaCycleDate(); // YYYY-MM-DD
  const userDocId = getDocIdForEmail(normalized);
  const historyDocId = `${userDocId}_${date}`;
  const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.databaseId}/documents/ai_daily_usage_history/${historyDocId}?key=${cfg.apiKey}`;

  try {
    const getResp = await fetch(url);
    let existingCalls = 0;
    let existingTokens = 0;

    if (getResp.ok) {
      const doc = await getResp.json();
      const parsed = parseFirestoreDoc(doc);
      existingCalls = Number(parsed.calls) || 0;
      existingTokens = Number(parsed.tokens) || 0;
    }

    const updatedData = {
      email: normalized,
      date,
      calls: existingCalls + 1,
      tokens: existingTokens + tokens,
      lastUpdatedAt: Date.now()
    };

    const fields = toFirestoreFields(updatedData);
    await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields })
    });
  } catch (err) {
    console.warn('Error recording daily usage history:', err);
  }
}

async function recordUsageAndHistory(email: string, tokens: number) {
  const normalized = normalizeEmail(email);
  if (!normalized) return;

  try {
    const record = await getWhitelistUserFromFirestore(normalized);
    if (record) {
      record.totalTokensUsed = (Number(record.totalTokensUsed) || 0) + tokens;
      await saveWhitelistUserToFirestore(record);
    }
  } catch (err) {
    console.warn('Error updating totalTokensUsed in whitelist:', err);
  }

  await recordDailyUsageHistory(normalized, tokens);
}

interface AuthAIResult {
  allowed: boolean;
  statusCode?: number;
  errorMessage?: string;
  isQuotaExceeded?: boolean;
  apiKeyToUse: string | null;
  whitelistUser?: any;
  developerQuota?: {
    dailyLimit: number;
    todayUsage: number;
    remaining: number;
    quotaCycleDate: string;
    status: string;
    isAdmin?: boolean;
  };
}

// Core authorization and quota-enforcement engine
async function validateAndAuthoriseAiRequest(
  customApiKey?: string,
  userEmail?: string,
  apiKeySource?: string,
  uid?: string,
  tokensUsed?: number
): Promise<AuthAIResult> {
  const cleanCustomKey = (customApiKey && typeof customApiKey === 'string') ? customApiKey.trim() : '';
  const isDeveloperMode = apiKeySource === 'developer' || !cleanCustomKey;

  // 1. Custom User Key Mode
  if (!isDeveloperMode && cleanCustomKey.length > 10) {
    return {
      allowed: true,
      apiKeyToUse: cleanCustomKey,
    };
  }

  // 2. Developer Key Mode (Backend-managed)
  const devKey = (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) || '';
  if (!devKey) {
    return {
      allowed: false,
      statusCode: 400,
      errorMessage: '後端未偵測到開發者 GEMINI_API_KEY。請至「設定」輸入您的個人 Gemini API Key 即可開啟完整 AI 功能！',
    };
  }

  const normalizedEmail = normalizeEmail(userEmail || '');
  if (!normalizedEmail) {
    return {
      allowed: false,
      statusCode: 401,
      errorMessage: '使用「開發者共享 AI 金鑰」需先登入 Google 帳號。請先登入後提出使用申請。',
    };
  }

  const isAdmin = normalizedEmail === ADMIN_EMAIL;
  const currentCycleDate = getServerGoogleApiQuotaCycleDate();

  let userRecord = await getWhitelistUserFromFirestore(normalizedEmail);

  // Auto-provision admin if record does not exist
  if (isAdmin && !userRecord) {
    userRecord = {
      email: normalizedEmail,
      uid: uid || '',
      displayName: '開發者 (Admin)',
      status: 'approved',
      dailyLimit: 1000,
      todayUsage: 0,
      totalUsage: 0,
      quotaCycleDate: currentCycleDate,
      requestedAt: Date.now(),
      approvedAt: Date.now(),
      notes: '系統管理員 (無限制/高額度)',
    };
    await saveWhitelistUserToFirestore(userRecord);
  }

  if (!userRecord) {
    return {
      allowed: false,
      statusCode: 403,
      errorMessage: '尚未加入開發者 AI 共享白名單。請至「設定」頁面送出使用申請。',
      whitelistUser: { email: normalizedEmail, status: 'not_requested' },
      developerQuota: {
        dailyLimit: 20,
        todayUsage: 0,
        remaining: 0,
        quotaCycleDate: currentCycleDate,
        status: 'not_requested',
        isAdmin,
      },
    };
  }

  if (userRecord.status === 'pending') {
    return {
      allowed: false,
      statusCode: 403,
      errorMessage: '您的開發者 AI 共享金鑰申請正在審核中，請稍候開發者審核。',
      whitelistUser: userRecord,
      developerQuota: {
        dailyLimit: Number(userRecord.dailyLimit) || 20,
        todayUsage: Number(userRecord.todayUsage) || 0,
        remaining: 0,
        quotaCycleDate: currentCycleDate,
        status: 'pending',
        isAdmin,
      },
    };
  }

  if (userRecord.status === 'rejected') {
    return {
      allowed: false,
      statusCode: 403,
      errorMessage: '暫未開放此帳號使用開發者共享金鑰，請至設定改用個人 API Key。',
      whitelistUser: userRecord,
      developerQuota: {
        dailyLimit: Number(userRecord.dailyLimit) || 20,
        todayUsage: Number(userRecord.todayUsage) || 0,
        remaining: 0,
        quotaCycleDate: currentCycleDate,
        status: 'rejected',
        isAdmin,
      },
    };
  }

  if (userRecord.status !== 'approved') {
    return {
      allowed: false,
      statusCode: 403,
      errorMessage: '您的開發者 AI 共享權限狀態異常，請聯繫開發者。',
      whitelistUser: userRecord,
    };
  }

  // Quota Cycle Rollover (PT midnight reset)
  let todayUsage = Number(userRecord.todayUsage) || 0;
  if (userRecord.quotaCycleDate !== currentCycleDate) {
    todayUsage = 0;
    userRecord.todayUsage = 0;
    userRecord.quotaCycleDate = currentCycleDate;
  }

  const dailyLimit = Number(userRecord.dailyLimit) || (isAdmin ? 1000 : 20);

  // Check 20-call daily quota limit
  if (!isAdmin && todayUsage >= dailyLimit) {
    return {
      allowed: false,
      statusCode: 429,
      isQuotaExceeded: true,
      errorMessage: `今日開發者 AI 共享額度已用完（已達每日 ${dailyLimit} 次上限）。將於 00:00 PT 自動重設，或請至「設定」改用個人 API Key。`,
      whitelistUser: userRecord,
      developerQuota: {
        dailyLimit,
        todayUsage,
        remaining: 0,
        quotaCycleDate: currentCycleDate,
        status: 'approved',
        isAdmin,
      },
    };
  }

  // Increment usage
  const nextTodayUsage = todayUsage + 1;
  const nextTotalUsage = (Number(userRecord.totalUsage) || 0) + 1;
  const nextTotalTokensUsed = (Number(userRecord.totalTokensUsed) || 0) + (tokensUsed || 0);

  userRecord.todayUsage = nextTodayUsage;
  userRecord.totalUsage = nextTotalUsage;
  userRecord.totalTokensUsed = nextTotalTokensUsed;
  userRecord.quotaCycleDate = currentCycleDate;
  userRecord.lastUsedAt = Date.now();
  if (uid && !userRecord.uid) userRecord.uid = uid;

  // Background update firestore
  saveWhitelistUserToFirestore(userRecord).catch((err) => {
    console.error('Failed to update whitelist usage in background:', err);
  });

  return {
    allowed: true,
    apiKeyToUse: devKey,
    whitelistUser: userRecord,
    developerQuota: {
      dailyLimit,
      todayUsage: nextTodayUsage,
      remaining: Math.max(0, dailyLimit - nextTodayUsage),
      quotaCycleDate: currentCycleDate,
      status: 'approved',
      isAdmin,
    },
  };
}

// Multi-model fallback runner to guarantee uptime within the Gemini 3.x family
async function generateWithFallback(
  ai: GoogleGenAI,
  preferredModel: string,
  contents: any,
  useSearch = false
): Promise<{
  text: string;
  modelUsed: string;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}> {
  // STRICTLY Gemini 3.x models only as per AGENTS.md
  const candidateModels = Array.from(
    new Set([
      preferredModel,
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
    ].filter(m => m && (m.startsWith('gemini-3.') || m.includes('flash'))))
  );

  let lastError: any = null;

  for (const modelName of candidateModels) {
    const isLite = modelName.includes('lite');
    // Try with search if requested; if search fails, try without search as fallback
    const searchOptions = useSearch ? [true, false] : [false];

    for (const searchFlag of searchOptions) {
      try {
        console.log(`[Gemini Request] Attempting model: ${modelName} (Search: ${searchFlag})...`);
        const config: any = {
          model: modelName,
          contents: Array.isArray(contents) ? contents : [{ role: 'user', parts: [{ text: contents }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: isLite ? 0.4 : 0.7,
          }
        };

        if (searchFlag) {
          config.tools = [{ googleSearch: {} }];
        }

        const response = await ai.models.generateContent(config);
        const text = response.text;
        if (text && text.trim().length > 0) {
          console.log(`[Gemini Success] Successfully generated with ${modelName} (Search: ${searchFlag})`);
          const promptTokens = Number(response.usageMetadata?.promptTokenCount) || 0;
          const candidatesTokens = Number(response.usageMetadata?.candidatesTokenCount) || 0;
          const totalTokens = Number(response.usageMetadata?.totalTokenCount) || (promptTokens + candidatesTokens);

          return {
            text: text.trim(),
            modelUsed: modelName,
            usageMetadata: {
              promptTokenCount: promptTokens,
              candidatesTokenCount: candidatesTokens,
              totalTokenCount: totalTokens,
            },
          };
        }
      } catch (err: any) {
        lastError = err;
        let status = err.status || err.code || 0;
        const message = err.message || '';

        if (!status && message) {
          const match = message.match(/503|429|500|400|401|403/);
          if (match) {
            status = parseInt(match[0], 10);
          }
        }

        console.warn(`[Gemini Attempt Failed] Model: ${modelName}, Search: ${searchFlag}, Status: ${status}, Msg: ${message}`);

        // If it's explicitly an API key / auth / permission error, throw immediately
        if (
          status === 400 || status === 401 || status === 403 ||
          message.includes('API_KEY_INVALID') ||
          message.includes('API key not valid') ||
          message.includes('PERMISSION_DENIED') ||
          message.includes('UNAUTHENTICATED')
        ) {
          throw new Error('Gemini API Key 無效或未開通權限，請至「設定」確認您的 API Key。');
        }
      }
    }
  }

  if (lastError) {
    const msg = lastError.message || '';
    if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('exceeded your current quota') || lastError.status === 429) {
      throw new Error('Gemini API 額度已達上限 (Quota Exceeded)，請稍後再試或至「設定」改用個人 API Key。');
    }
    if (msg) {
      throw new Error(`AI 服務暫時無法回應 (${msg.slice(0, 100)})`);
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

// Whitelist & Developer Quota Management Endpoints
app.get('/api/ai/developer-quota', async (req, res) => {
  try {
    const userEmail = (req.query.userEmail as string) || (req.headers['x-user-email'] as string) || '';
    const normalizedEmail = normalizeEmail(userEmail);
    const isAdmin = normalizedEmail === ADMIN_EMAIL;
    const currentCycleDate = getServerGoogleApiQuotaCycleDate();

    if (!normalizedEmail) {
      return res.json({
        status: 'not_requested',
        dailyLimit: 20,
        todayUsage: 0,
        remaining: 20,
        quotaCycleDate: currentCycleDate,
        isAdmin: false,
      });
    }

    let userRecord = await getWhitelistUserFromFirestore(normalizedEmail);
    if (isAdmin && !userRecord) {
      userRecord = {
        email: normalizedEmail,
        displayName: '開發者 (Admin)',
        status: 'approved',
        dailyLimit: 1000,
        todayUsage: 0,
        totalUsage: 0,
        quotaCycleDate: currentCycleDate,
        requestedAt: Date.now(),
        approvedAt: Date.now(),
        notes: '系統管理員',
      };
      await saveWhitelistUserToFirestore(userRecord);
    }

    if (!userRecord) {
      return res.json({
        status: 'not_requested',
        email: normalizedEmail,
        dailyLimit: 20,
        todayUsage: 0,
        remaining: 20,
        quotaCycleDate: currentCycleDate,
        isAdmin,
      });
    }

    let todayUsage = Number(userRecord.todayUsage) || 0;
    if (userRecord.quotaCycleDate !== currentCycleDate) {
      todayUsage = 0;
      userRecord.todayUsage = 0;
      userRecord.quotaCycleDate = currentCycleDate;
    }

    const dailyLimit = Number(userRecord.dailyLimit) || (isAdmin ? 1000 : 20);
    const remaining = Math.max(0, dailyLimit - todayUsage);

    res.json({
      status: userRecord.status,
      email: userRecord.email,
      displayName: userRecord.displayName,
      dailyLimit,
      todayUsage,
      remaining,
      totalUsage: Number(userRecord.totalUsage) || 0,
      totalTokensUsed: Number(userRecord.totalTokensUsed) || 0,
      quotaCycleDate: currentCycleDate,
      requestedAt: userRecord.requestedAt,
      approvedAt: userRecord.approvedAt,
      lastUsedAt: userRecord.lastUsedAt,
      isAdmin,
    });
  } catch (error: any) {
    console.error('Get developer quota error:', error);
    res.status(500).json({ error: error.message || '查詢額度失敗' });
  }
});

app.get('/api/ai/daily-history', async (req, res) => {
  try {
    const userEmail = normalizeEmail((req.query.userEmail as string) || (req.headers['x-user-email'] as string) || '');
    const targetEmail = normalizeEmail(req.query.targetEmail as string || '');
    const isAdmin = userEmail === ADMIN_EMAIL;

    // Normal users can only query their own history. Admin can query anyone or site-wide.
    const queryEmail = isAdmin ? (targetEmail || null) : userEmail;

    const cfg = getFirestoreConfig();
    const url = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.databaseId}/documents:runQuery?key=${cfg.apiKey}`;

    // Query all daily history records
    const queryBody: any = {
      structuredQuery: {
        from: [{ collectionId: 'ai_daily_usage_history' }]
      }
    };

    if (queryEmail) {
      queryBody.structuredQuery.where = {
        fieldFilter: {
          field: { fieldPath: 'email' },
          op: 'EQUAL',
          value: { stringValue: queryEmail }
        }
      };
    }

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryBody)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(500).json({ error: `Query daily history failed: ${errText}` });
    }

    const rawData = await resp.json();
    const docs = (rawData || [])
      .map((item: any) => item.document)
      .filter(Boolean)
      .map(parseFirestoreDoc);

    // If targetEmail is null and we are admin, we group and sum by date for site-wide view!
    if (isAdmin && !targetEmail) {
      const grouped: Record<string, { date: string; calls: number; tokens: number }> = {};
      for (const doc of docs) {
        const d = doc.date;
        if (!d) continue;
        if (!grouped[d]) {
          grouped[d] = { date: d, calls: 0, tokens: 0 };
        }
        grouped[d].calls += Number(doc.calls) || 0;
        grouped[d].tokens += Number(doc.tokens) || 0;
      }
      const history = Object.values(grouped).sort((a, b) => b.date.localeCompare(a.date));
      return res.json({ history });
    }

    // Sort by date descending
    const history = docs.sort((a, b) => b.date.localeCompare(a.date));
    res.json({ history });
  } catch (error: any) {
    console.error('Get daily history error:', error);
    res.status(500).json({ error: error.message || '無法取得每日使用紀錄' });
  }
});

app.post('/api/ai/clear-usage-stats', async (req, res) => {
  try {
    const userEmail = normalizeEmail((req.body.userEmail as string) || (req.headers['x-user-email'] as string) || '');
    if (userEmail !== ADMIN_EMAIL) {
      return res.status(403).json({ error: '只有系統管理員能清除統計次數。' });
    }

    const cfg = getFirestoreConfig();

    // 1. Reset all users in ai_whitelist
    const users = await getAllWhitelistUsers();
    for (const u of users) {
      u.todayUsage = 0;
      u.totalUsage = 0;
      u.totalTokensUsed = 0;
      await saveWhitelistUserToFirestore(u);
    }

    // 2. Clear all documents in ai_daily_usage_history
    const historyQueryUrl = `https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/${cfg.databaseId}/documents:runQuery?key=${cfg.apiKey}`;
    const runQueryResp = await fetch(historyQueryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'ai_daily_usage_history' }]
        }
      })
    });

    if (runQueryResp.ok) {
      const rawData = await runQueryResp.json();
      const docs = (rawData || [])
        .map((item: any) => item.document)
        .filter(Boolean);

      for (const d of docs) {
        const docName = d.name; 
        if (!docName) continue;
        const deleteUrl = `https://firestore.googleapis.com/v1/${docName}?key=${cfg.apiKey}`;
        await fetch(deleteUrl, { method: 'DELETE' });
      }
    }

    res.json({ success: true, message: '統計數據與每日歷史已成功清除。' });
  } catch (error: any) {
    console.error('Clear usage stats error:', error);
    res.status(500).json({ error: error.message || '清除統計數據失敗' });
  }
});

app.post('/api/ai/request-access', async (req, res) => {
  try {
    const { email, uid, displayName, photoURL, notes } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ error: '請提供有效的 Email 地址' });
    }

    const isAdmin = normalizedEmail === ADMIN_EMAIL;
    const currentCycleDate = getServerGoogleApiQuotaCycleDate();
    let existing = await getWhitelistUserFromFirestore(normalizedEmail);

    if (existing) {
      if (existing.status === 'rejected') {
        existing.status = 'pending';
        existing.requestedAt = Date.now();
        existing.notes = notes || existing.notes;
        if (displayName) existing.displayName = displayName;
        if (photoURL) existing.photoURL = photoURL;
        if (uid) existing.uid = uid;
        await saveWhitelistUserToFirestore(existing);
        return res.json({
          success: true,
          message: '已重新送出申請，等待開發者審核',
          user: existing,
        });
      }
      return res.json({
        success: true,
        message: existing.status === 'approved' ? '此帳號已獲授權' : '申請正在審核中',
        user: existing,
      });
    }

    const newRecord = {
      email: normalizedEmail,
      uid: uid || '',
      displayName: displayName || normalizedEmail.split('@')[0],
      photoURL: photoURL || '',
      status: isAdmin ? 'approved' : 'pending',
      dailyLimit: isAdmin ? 1000 : 20,
      todayUsage: 0,
      totalUsage: 0,
      quotaCycleDate: currentCycleDate,
      requestedAt: Date.now(),
      approvedAt: isAdmin ? Date.now() : null,
      notes: notes || '',
    };

    await saveWhitelistUserToFirestore(newRecord);
    res.json({
      success: true,
      message: isAdmin ? '管理員已自動核准' : '申請已成功送出！開發者 Kevin 將會盡快為您審核。',
      user: newRecord,
    });
  } catch (error: any) {
    console.error('Request whitelist access error:', error);
    res.status(500).json({ error: error.message || '送出申請失敗' });
  }
});

// Admin Whitelist Management
app.get('/api/admin/whitelist', async (req, res) => {
  try {
    const adminEmail = normalizeEmail((req.query.adminEmail as string) || (req.headers['x-admin-email'] as string) || '');
    if (adminEmail !== ADMIN_EMAIL) {
      return res.status(403).json({ error: '權限不足：僅限系統管理員 (Kevin) 存取' });
    }

    let users = await getAllWhitelistUsers();

    // Auto provision admin if missing
    const hasAdmin = users.some((u) => normalizeEmail(u.email) === ADMIN_EMAIL);
    if (!hasAdmin) {
      const currentCycleDate = getServerGoogleApiQuotaCycleDate();
      const adminRecord = {
        email: ADMIN_EMAIL,
        displayName: '開發者 (Admin)',
        status: 'approved',
        dailyLimit: 1000,
        todayUsage: 0,
        totalUsage: 0,
        quotaCycleDate: currentCycleDate,
        requestedAt: Date.now(),
        approvedAt: Date.now(),
        notes: '系統管理員 (無限制/高額度)',
      };
      await saveWhitelistUserToFirestore(adminRecord).catch((e) => {
        console.warn('Failed to auto-save admin to whitelist:', e);
      });
      users = await getAllWhitelistUsers();
      if (!users.some((u) => normalizeEmail(u.email) === ADMIN_EMAIL)) {
        users.unshift(adminRecord);
      }
    }

    users.sort((a, b) => {
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return (b.requestedAt || 0) - (a.requestedAt || 0);
    });

    res.json({ users });
  } catch (error: any) {
    console.error('Admin list whitelist error:', error);
    res.status(500).json({ error: error.message || '無法取得白名單列表' });
  }
});

app.post('/api/admin/whitelist/update', async (req, res) => {
  try {
    const { adminEmail, targetEmail, status, dailyLimit, resetTodayUsage, notes, displayName } = req.body;
    const normalizedAdmin = normalizeEmail(adminEmail || (req.headers['x-admin-email'] as string) || '');
    if (normalizedAdmin !== ADMIN_EMAIL) {
      return res.status(403).json({ error: '權限不足：僅限系統管理員存取' });
    }

    const normalizedTarget = normalizeEmail(targetEmail);
    if (!normalizedTarget) {
      return res.status(400).json({ error: '請提供目標 Email' });
    }

    let existing = await getWhitelistUserFromFirestore(normalizedTarget);
    const currentCycleDate = getServerGoogleApiQuotaCycleDate();

    if (!existing) {
      existing = {
        email: normalizedTarget,
        displayName: displayName || normalizedTarget.split('@')[0],
        status: status || 'approved',
        dailyLimit: dailyLimit !== undefined ? Number(dailyLimit) : 20,
        todayUsage: 0,
        totalUsage: 0,
        quotaCycleDate: currentCycleDate,
        requestedAt: Date.now(),
        approvedAt: status === 'approved' ? Date.now() : null,
        notes: notes || '',
      };
    } else {
      if (status) {
        existing.status = status;
        if (status === 'approved' && !existing.approvedAt) {
          existing.approvedAt = Date.now();
        }
      }
      if (dailyLimit !== undefined && dailyLimit !== null) {
        existing.dailyLimit = Number(dailyLimit);
      }
      if (resetTodayUsage === true) {
        existing.todayUsage = 0;
        existing.quotaCycleDate = currentCycleDate;
      }
      if (notes !== undefined) {
        existing.notes = notes;
      }
      if (displayName) {
        existing.displayName = displayName;
      }
    }

    const saved = await saveWhitelistUserToFirestore(existing);
    res.json({ success: true, ok: true, user: saved });
  } catch (error: any) {
    console.error('Admin update whitelist error:', error);
    res.status(500).json({ error: error.message || '更新白名單失敗' });
  }
});

app.post('/api/admin/whitelist/delete', async (req, res) => {
  try {
    const { adminEmail, targetEmail } = req.body;
    const normalizedAdmin = normalizeEmail(adminEmail || (req.headers['x-admin-email'] as string) || '');
    if (normalizedAdmin !== ADMIN_EMAIL) {
      return res.status(403).json({ error: '權限不足：僅限系統管理員存取' });
    }

    const normalizedTarget = normalizeEmail(targetEmail);
    if (!normalizedTarget) {
      return res.status(400).json({ error: '請提供目標 Email' });
    }

    const ok = await deleteWhitelistUser(normalizedTarget);
    res.json({ success: ok, ok: ok });
  } catch (error: any) {
    console.error('Admin delete whitelist error:', error);
    res.status(500).json({ error: error.message || '刪除白名單失敗' });
  }
});

// AI Endpoints
app.all('/api/ai/test-connection', async (req, res) => {
  const startTime = Date.now();
  try {
    const customKey = req.body?.customApiKey || (req.query?.customApiKey as string);
    const model = req.body?.model || (req.query?.model as string) || 'gemini-3.8-flash';
    const userEmail = req.body?.userEmail || (req.query?.userEmail as string);
    const apiKeySource = req.body?.apiKeySource || (req.query?.apiKeySource as string);
    const userUid = req.body?.userUid || (req.query?.userUid as string);

    const authResult = await validateAndAuthoriseAiRequest(customKey, userEmail, apiKeySource, userUid, 0);
    if (!authResult.allowed) {
      return res.status(authResult.statusCode || 403).json({
        ok: false,
        error: authResult.errorMessage,
        isQuotaExceeded: authResult.isQuotaExceeded,
        _developerQuota: authResult.developerQuota,
      });
    }

    const ai = getGenAIClient(authResult.apiKeyToUse!);

    const { text, modelUsed, usageMetadata } = await generateWithFallback(
      ai,
      model,
      '請回覆：「連線成功」'
    );

    const latencyMs = Date.now() - startTime;
    const totalTokens = usageMetadata?.totalTokenCount || 0;
    if (userEmail) {
      recordUsageAndHistory(userEmail, totalTokens).catch(err => {
        console.warn('Error recording usage/history:', err);
      });
    }

    res.json({
      ok: true,
      message: 'Gemini AI API 通訊完全正常！',
      modelUsed,
      requestedModel: model,
      sampleResponse: text,
      latencyMs,
      _developerQuota: authResult.developerQuota,
      _usage: {
        promptTokens: usageMetadata?.promptTokenCount || 0,
        candidatesTokens: usageMetadata?.candidatesTokenCount || 0,
        totalTokens,
        model: modelUsed,
        feature: 'connection_test',
      },
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
    const { query, customApiKey, model, userEmail, apiKeySource, userUid } = req.body;
    if (!query) {
      return res.status(400).json({ error: '請輸入飲食名稱' });
    }

    const authResult = await validateAndAuthoriseAiRequest(customApiKey, userEmail, apiKeySource, userUid, 0);
    if (!authResult.allowed) {
      return res.status(authResult.statusCode || 403).json({
        error: authResult.errorMessage,
        isQuotaExceeded: authResult.isQuotaExceeded,
        _developerQuota: authResult.developerQuota,
      });
    }

    const ai = getGenAIClient(authResult.apiKeyToUse!);

    const prompt = `你是一位專業營養師。請分析食物「${query}」並以 JSON 格式回傳每 100g 的營養成分。
如果是連鎖品牌 (如 7-11, 全家, 麥當勞) 請優先搜尋官方數據。
1. 品牌 (brand): 僅填寫品牌/超商名稱，無品牌則填 ""。
2. 份量: defaultServingAmount 須為常見單一份量(如 180)，servingUnit 填 g 或 ml。
3. 嚴格遵守 JSON 格式：
{
  "name": "食物名稱",
  "brand": "品牌或空字串",
  "caloriesPer100g": 數字,
  "carbsPer100g": 數字,
  "proteinPer100g": 數字,
  "fatPer100g": 數字,
  "sugarsPer100g": 數字,
  "fiberPer100g": 數字,
  "sodiumPer100g": 數字,
  "potassiumPer100g": 數字,
  "defaultServingAmount": 數字,
  "servingUnit": "g" | "ml",
  "servingSizeText": "份量說明",
  "explanation": "50字內建議"
}`;

    const { text, modelUsed, usageMetadata } = await generateWithFallback(
      ai,
      model || 'gemini-3.1-flash-lite',
      prompt,
      true // Enable Search Grounding
    );

    // In JSON mode, text is a pure JSON string
    const parsed = extractJsonFromText(text);
    if (parsed.brand) {
      parsed.brand = normalizeConvenienceStoreBrand(parsed.brand);
    }
    if (!parsed.brand || !String(parsed.brand).trim()) {
      parsed.brand = 'AI辨識';
    }
    const totalTokens = usageMetadata?.totalTokenCount || 0;
    if (userEmail) {
      recordUsageAndHistory(userEmail, totalTokens).catch(err => {
        console.warn('Error recording usage/history:', err);
      });
    }

    parsed._modelUsed = modelUsed;
    parsed._developerQuota = authResult.developerQuota;
    parsed._usage = {
      promptTokens: usageMetadata?.promptTokenCount || 0,
      candidatesTokens: usageMetadata?.candidatesTokenCount || 0,
      totalTokens,
      model: modelUsed,
      feature: 'nutrition_estimate',
    };
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
    const { imageBase64, mimeType = 'image/jpeg', customApiKey, model, userEmail, apiKeySource, userUid } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: '未提供圖片資料' });
    }

    const authResult = await validateAndAuthoriseAiRequest(customApiKey, userEmail, apiKeySource, userUid, 0);
    if (!authResult.allowed) {
      return res.status(authResult.statusCode || 403).json({
        error: authResult.errorMessage,
        isQuotaExceeded: authResult.isQuotaExceeded,
        _developerQuota: authResult.developerQuota,
      });
    }

    const ai = getGenAIClient(authResult.apiKeyToUse!);

    const prompt = `請分析圖片中的食物。若包裝上有「營養標示」，嚴格依其數值回傳。
1. 品牌: 台灣超商標準化 (7-11, 全家, 萊爾富, OK)。
2. 份量: 以「單一份」基準，勿回傳整包總重。
3. 數據: 若無標示纖維/鉀/糖，請填 0。純生魚片/刺身之碳水/糖須為 0。
4. 格式要求：
{
  "name": "品名",
  "brand": "品牌或空字串",
  "barcode": "條碼或空字串",
  "caloriesPer100g": 數字,
  "carbsPer100g": 數字,
  "proteinPer100g": 數字,
  "fatPer100g": 數字,
  "sugarsPer100g": 數字,
  "fiberPer100g": 數字,
  "sodiumPer100g": 數字,
  "potassiumPer100g": 數字,
  "defaultServingAmount": 數字,
  "servingUnit": "g" | "ml",
  "servingSizeText": "份量說明",
  "explanation": "分析建議"
}`;

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

    const { text, modelUsed, usageMetadata } = await generateWithFallback(
      ai,
      model || 'gemini-3.8-flash',
      contents,
      false
    );

    // In JSON mode, text is a pure JSON string
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
    const totalTokens = usageMetadata?.totalTokenCount || 0;
    if (userEmail) {
      recordUsageAndHistory(userEmail, totalTokens).catch(err => {
        console.warn('Error recording usage/history:', err);
      });
    }

    parsed._modelUsed = modelUsed;
    parsed._developerQuota = authResult.developerQuota;
    parsed._usage = {
      promptTokens: usageMetadata?.promptTokenCount || 0,
      candidatesTokens: usageMetadata?.candidatesTokenCount || 0,
      totalTokens,
      model: modelUsed,
      feature: 'image_recognition',
    };
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

// 3.1. AI Barcode OCR reader from photo
app.post('/api/ai/read-barcode', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', customApiKey, model, userEmail, apiKeySource, userUid } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: '未提供圖片資料' });
    }

    const authResult = await validateAndAuthoriseAiRequest(customApiKey, userEmail, apiKeySource, userUid, 0);
    if (!authResult.allowed) {
      return res.status(authResult.statusCode || 403).json({
        error: authResult.errorMessage,
        barcode: null,
        isQuotaExceeded: authResult.isQuotaExceeded,
        _developerQuota: authResult.developerQuota,
      });
    }

    const ai = getGenAIClient(authResult.apiKeyToUse!);

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const prompt = `Please examine this photo closely and locate any product barcode (such as EAN-13, EAN-8, UPC-A, UPC-E, Code 128, or QR Code digits).
Identify the numbers/digits printed directly under or on the barcode lines.
Output ONLY the clean numerical digits (0-9). Do NOT include spaces, dashes, or letters unless it's a valid alphanumeric code.
If no readable barcode numbers are visible in the image, reply ONLY with 'NONE'.`;

    const contents = [
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64Data,
        },
      },
    ];

    const { text, modelUsed, usageMetadata } = await generateWithFallback(
      ai,
      model || 'gemini-3.1-flash-lite',
      contents,
      false
    );

    const cleaned = text.replace(/[^0-9a-zA-Z]/g, '').trim();
    const barcodeResult = (cleaned && cleaned !== 'NONE' && cleaned.length >= 6) ? cleaned : null;
    const totalTokens = usageMetadata?.totalTokenCount || 0;
    if (userEmail) {
      recordUsageAndHistory(userEmail, totalTokens).catch(err => {
        console.warn('Error recording usage/history:', err);
      });
    }

    res.json({
      barcode: barcodeResult,
      _developerQuota: authResult.developerQuota,
      _usage: {
        promptTokens: usageMetadata?.promptTokenCount || 0,
        candidatesTokens: usageMetadata?.candidatesTokenCount || 0,
        totalTokens,
        model: modelUsed,
        feature: 'barcode_ocr',
      },
    });
  } catch (error: any) {
    console.error('AI Read Barcode error:', error);
    res.status(500).json({ error: error.message || '條碼辨識失敗', barcode: null });
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

// 3.6. McDonald's Taiwan Live Crawler Search
app.post('/api/mcd/search', async (req, res) => {
  try {
    const { keyword, crawlAll } = req.body;
    const cleanQuery = (keyword || '').trim();
    if (!crawlAll && !cleanQuery) {
      return res.json({ products: [] });
    }

    console.log(`[Crawler] Attempting live crawl to McDonald's Taiwan nutrition calculator (crawlAll: ${!!crawlAll}, query: "${cleanQuery}")...`);
    
    const safariUa = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15";
    const mcdUrl = "https://www.mcdonalds.com/tw/zh-tw/sustainability/good-food/nutrition-calculator.html";
    
    const mcdRes = await fetch(mcdUrl, {
      headers: {
        "User-Agent": safariUa,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    });

    if (!mcdRes.ok) {
      throw new Error("無法連線至麥當勞官網");
    }

    const html = await mcdRes.text();
    const $ = cheerio.load(html);
    const datasetJson = $('.cmp-nutrition-calculator').attr('data-product-data');
    
    if (!datasetJson) {
      return res.json({ products: [] });
    }

    const dataset = JSON.parse(datasetJson);
    const productsDict = dataset.products || {};
    
    const matchedIds: string[] = [];
    const cleanQueryLower = cleanQuery.toLowerCase();

    for (const [id, prod] of Object.entries(productsDict) as [string, any][]) {
      const title = prod.title || "";
      if (crawlAll || !cleanQueryLower) {
        matchedIds.push(id);
      } else if (title.toLowerCase().includes(cleanQueryLower) || cleanQueryLower.includes(title.toLowerCase().replace(/®|™/g, ""))) {
        matchedIds.push(id);
      }
    }

    const finalItems: any[] = [];

    if (matchedIds.length > 0) {
      // Split into chunks of 30 to avoid extremely long URL strings
      const chunkSize = 30;
      for (let i = 0; i < matchedIds.length; i += chunkSize) {
        const chunk = matchedIds.slice(i, i + chunkSize);
        const itemParam = chunk.map(id => `${id}()-`).join("");
        const apiUrl = `https://www.mcdonalds.com/dnaapp/itemList?country=TW&language=zh&showLiveData=true&nutrient_req=Y&item=${encodeURIComponent(itemParam)}`;
        
        try {
          const apiRes = await fetch(apiUrl, {
            headers: {
              "User-Agent": safariUa,
              "Accept": "application/json, text/plain, */*",
              "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
              "Referer": mcdUrl
            }
          });

          if (apiRes.ok) {
            const apiData = await apiRes.json() as any;
            const rawItems = apiData.items?.item || [];
            const itemsList = Array.isArray(rawItems) ? rawItems : [rawItems];

            for (const item of itemsList) {
              if (!item || !item.item_name) continue;

              const name = item.item_name.replace(/®|™/g, "").trim();
              const productId = item.id || item.item_id;
              const nutrients = item.nutrient_facts?.nutrient || [];
              
              let calories = 0, protein = 0, fat = 0, carbs = 0, sodium = 0, sugars = 0, fiber = 0, servingAmount = 0;
              let servingUnit = "g";

              for (const nut of nutrients) {
                const valStr = (nut.value || "0").replace(/,/g, "").trim();
                const val = parseFloat(valStr) || 0;

                switch (nut.nutrient_name_id) {
                  case "energy_kcal": calories = val; break;
                  case "protein": protein = val; break;
                  case "fat": fat = val; break;
                  case "carbohydrate": carbs = val; break;
                  case "salt": sodium = val; break;
                  case "sugars": sugars = val; break;
                  case "dietary_fibre": fiber = val; break;
                  case "primary_serving_size":
                    servingAmount = val;
                    servingUnit = nut.uom || "g";
                    break;
                }
              }

              const origProduct = productsDict[productId] || {};
              const desktopImageUrl = origProduct.desktopImageUrl || "";

              finalItems.push({
                id: `mcd_${productId}`,
                name: name,
                brand: "麥當勞 McDonald's",
                category: "FastFood",
                calories: Math.round(calories),
                protein: parseFloat(protein.toFixed(1)),
                fat: parseFloat(fat.toFixed(1)),
                carbs: parseFloat(carbs.toFixed(1)),
                sodium: Math.round(sodium),
                sugars: parseFloat(sugars.toFixed(1)),
                fiber: Math.round(fiber),
                potassium: 0,
                imageUrl: desktopImageUrl,
                isLocalPreset: false,
                servingAmount: Math.round(servingAmount) || 100,
                servingSizeText: `${Math.round(servingAmount) || 100}${servingUnit}`,
                servingUnit: servingUnit,
                officialSourceNote: "台灣麥當勞官網公開營養計算機 (實時爬取)",
                verified: true,
                tags: ["官網實時爬取", "美式速食", "經典品項"]
              });
            }
          }
        } catch (chunkErr) {
          console.error('[Crawler] Error fetching chunk for McDonald:', chunkErr);
        }
      }
    }

    res.json({ products: finalItems });
  } catch (error: any) {
    console.error('McDonald search error:', error);
    res.status(500).json({ error: error.message || '麥當勞搜尋發生錯誤' });
  }
});

// 3.7. Taiwan SUBWAY Live Crawler Search
app.post('/api/subway/search', async (req, res) => {
  try {
    const { keyword, crawlAll } = req.body;
    const cleanQuery = (keyword || '').trim();
    if (!crawlAll && !cleanQuery) {
      return res.json({ products: [] });
    }

    console.log(`[Crawler] Attempting live crawl to Taiwan Subway nutrition page (crawlAll: ${!!crawlAll}, query: "${cleanQuery}")...`);
    const safariUa = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15";
    const subwayUrl = "https://www.subway.com.tw/nutrition";
    const subRes = await fetch(subwayUrl, {
      headers: {
        "User-Agent": safariUa,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7"
      }
    });

    const finalItems: any[] = [];

    if (subRes.ok) {
      const html = await subRes.text();
      const $ = cheerio.load(html);
      let nutritionData: any = null;

      $('script').each((i, el) => {
        const text = $(el).html() || "";
        if (text.includes("nutritionData")) {
          try {
            const unescaped = text.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            const uIdx = unescaped.indexOf('"nutritionData":[');
            if (uIdx !== -1) {
              const startBracket = unescaped.indexOf('[', uIdx);
              let depth = 0, endIdx = -1;
              for (let c = startBracket; c < unescaped.length; c++) {
                if (unescaped[c] === '[') depth++;
                else if (unescaped[c] === ']') {
                  depth--;
                  if (depth === 0) { endIdx = c; break; }
                }
              }
              if (endIdx !== -1) {
                const jsonStr = unescaped.substring(startBracket, endIdx + 1);
                nutritionData = JSON.parse(jsonStr);
              }
            }
          } catch (e) {}
        }
      });

      if (nutritionData) {
        const allItems: any[] = [];
        for (const cat of nutritionData) {
          const catName = (cat.category || cat.title || cat.name || "").trim();
          const items = cat.items || [];
          for (const item of items) {
            allItems.push({ ...item, categoryName: catName });
          }
        }

        const cleanQueryLower = cleanQuery.toLowerCase();
        const matched = (crawlAll || !cleanQueryLower) ? allItems : allItems.filter(item => {
          const catName = (item.categoryName || "").toLowerCase();
          const name = (item.name || "").toLowerCase();
          const engName = (item.engName || "").toLowerCase();
          const combined = `${catName} ${name}`.trim();
          return name.includes(cleanQueryLower) || 
                 cleanQueryLower.includes(name) || 
                 catName.includes(cleanQueryLower) ||
                 combined.includes(cleanQueryLower) ||
                 engName.includes(cleanQueryLower);
        });

        for (const item of matched) {
          const calories = parseFloat(item.calories) || 0;
          const protein = parseFloat(item.protein) || 0;
          const fat = parseFloat(item.fat) || 0;
          const carbs = parseFloat(item.carbs) || 0;
          const serving = parseFloat(item.serving) || 0;
          const sodium = parseFloat(item.sodium || item.salt || 0);
          const sugars = parseFloat(item.sugar || item.sugars || 0);

          const catName = (item.categoryName || "").trim();
          const itemName = (item.name || "").trim();
          let displayName = itemName;
          if (catName && !itemName.toLowerCase().includes(catName.toLowerCase())) {
            displayName = `${catName} ${itemName}`;
          }

          finalItems.push({
            id: `subway_${item._key || Math.random().toString(36).substring(2, 9)}`,
            name: displayName,
            brand: "SUBWAY",
            category: "FastFood",
            calories: Math.round(calories),
            protein: parseFloat(protein.toFixed(1)),
            fat: parseFloat(fat.toFixed(1)),
            carbs: parseFloat(carbs.toFixed(1)),
            sodium: Math.round(sodium),
            sugars: parseFloat(sugars.toFixed(1)),
            fiber: 0,
            potassium: 0,
            imageUrl: "",
            isLocalPreset: false,
            servingAmount: Math.round(serving),
            servingSizeText: `${Math.round(serving)}g`,
            servingUnit: "g",
            officialSourceNote: "台灣 Subway 官方營養計算表 (實時爬取)",
            verified: true,
            tags: ["官網實時爬取", "Subway", "美式速食"]
          });
        }
      }
    }

    res.json({ products: finalItems });
  } catch (subErr: any) {
    console.error(`[Crawler] Subway live crawl failed:`, subErr);
    res.status(500).json({ error: subErr.message || 'Subway 搜尋發生錯誤' });
  }
});

// 4. Gemini Workout Recommendations
app.post('/api/ai/workout-suggest', async (req, res) => {
  try {
    const { bodyPart, customApiKey, model, userEmail, apiKeySource, userUid } = req.body;
    const authResult = await validateAndAuthoriseAiRequest(customApiKey, userEmail, apiKeySource, userUid, 0);

    if (!authResult.allowed) {
      return res.json({
        exercises: ['標準俯臥撐', '啞鈴推舉', '彈力帶夾胸', '棒式支撐'],
        _developerQuota: authResult.developerQuota,
        _authError: authResult.errorMessage,
      });
    }

    const ai = getGenAIClient(authResult.apiKeyToUse!);

    const prompt = `使用者想針對「${bodyPart || '全身'}」肌群進行健身訓練。
請推薦 4 到 6 個最有效、循序漸進的經典健身動作名稱。
請嚴格輸出 JSON 陣列，例如 ["動作1", "動作2", "動作3", "動作4"]，不要輸出其他文字或 markdown。`;

    const { text, modelUsed, usageMetadata } = await generateWithFallback(
      ai,
      model || 'gemini-3.8-flash',
      prompt
    );

    let exercises = ['標準俯臥撐', '啞鈴推舉', '彈力帶夾胸', '棒式支撐'];
    try {
      const parsed = extractJsonFromText(text);
      if (Array.isArray(parsed)) exercises = parsed;
    } catch {
      exercises = ['慢跑', '棒式', '深蹲', '伏地挺身'];
    }

    const totalTokens = usageMetadata?.totalTokenCount || 0;
    if (userEmail) {
      recordUsageAndHistory(userEmail, totalTokens).catch(err => {
        console.warn('Error recording usage/history:', err);
      });
    }

    res.json({
      exercises,
      _developerQuota: authResult.developerQuota,
      _usage: {
        promptTokens: usageMetadata?.promptTokenCount || 0,
        candidatesTokens: usageMetadata?.candidatesTokenCount || 0,
        totalTokens,
        model: modelUsed,
        feature: 'workout_suggest',
      },
    });
  } catch (error: any) {
    console.error('Workout suggest error:', error);
    res.json({ exercises: ['慢跑', '棒式', '深蹲', '伏地挺身'] });
  }
});

// 5. Open Food Facts proxy with Chinese-to-English translation & dual search
app.get('/api/openfoodfacts/search', async (req, res) => {
  try {
    const query = ((req.query.q as string) || '').trim();
    if (!query) return res.json({ products: [] });

    // Built-in dictionary for fast Chinese food term translation
    const quickDict: Record<string, string> = {
      '燕麥奶': 'oat milk',
      '燕麥': 'oatmeal oats',
      '地瓜': 'sweet potato',
      '番薯': 'sweet potato',
      '雞胸肉': 'chicken breast',
      '雞胸': 'chicken breast',
      '蛋白': 'protein',
      '蛋白棒': 'protein bar',
      '乳清': 'whey protein',
      '乳清蛋白': 'whey protein',
      '牛奶': 'milk',
      '鮮奶': 'fresh milk',
      '優格': 'yogurt',
      '希臘優格': 'greek yogurt',
      '黑咖啡': 'black coffee',
      '拿鐵': 'latte',
      '飯糰': 'rice ball',
      '麵包': 'bread',
      '吐司': 'toast',
      '巧克力': 'chocolate',
      '堅果': 'nuts',
      '沙拉': 'salad',
      '雞肉': 'chicken',
      '牛肉': 'beef',
      '豬肉': 'pork',
      '鮭魚': 'salmon',
      '鮪魚': 'tuna',
      '雞蛋': 'egg',
      '蛋': 'egg',
      '茶葉蛋': 'boiled egg',
      '豆漿': 'soy milk',
      '豆腐': 'tofu',
      '起司': 'cheese',
      '芝士': 'cheese',
      '花生醬': 'peanut butter',
      '能量棒': 'energy bar',
      '綠茶': 'green tea',
      '紅茶': 'black tea',
      '烏龍茶': 'oolong tea',
      '可可': 'cocoa',
      '蘋果': 'apple',
      '香蕉': 'banana',
      '酪梨': 'avocado',
      '藍莓': 'blueberry',
      '麥片': 'cereal',
      '高麗菜': 'cabbage',
      '花椰菜': 'broccoli',
      '菠菜': 'spinach',
      '水餃': 'dumpling',
    };

    let englishQuery = '';
    const hasChinese = /[\u4e00-\u9fa5]/.test(query);

    if (hasChinese) {
      if (quickDict[query]) {
        englishQuery = quickDict[query];
      } else {
        let translated = query;
        for (const [zh, en] of Object.entries(quickDict)) {
          if (translated.includes(zh)) {
            translated = translated.replace(zh, ` ${en} `);
          }
        }
        if (translated !== query) {
          englishQuery = translated.trim().replace(/\s+/g, ' ');
        }
      }

      // Fast Gemini AI Translation fallback (1.2s timeout to avoid slowing response)
      const customApiKey = req.query.customApiKey as string;
      const keyToUse = customApiKey || process.env.GEMINI_API_KEY;
      const ai = keyToUse ? getGenAIClient(keyToUse) : null;
      if (ai) {
        try {
          const aiPromise = generateWithFallback(
            ai,
            'gemini-3.1-flash-lite',
            `Translate the Chinese food search term "${query}" to 1-3 English keywords for Open Food Facts search. Return ONLY the English keywords, no punctuation or markdown.`,
            false
          );
          const timeoutPromise = new Promise<{ text: string; modelUsed: string }>((_, reject) =>
            setTimeout(() => reject(new Error('Translation timeout')), 1200)
          );
          const aiRes = await Promise.race([aiPromise, timeoutPromise]);
          if (aiRes && aiRes.text) {
            const cleanText = aiRes.text.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
            if (cleanText.length > 1) {
              englishQuery = englishQuery ? `${englishQuery} ${cleanText}` : cleanText;
            }
          }
        } catch {
          // AI translation fallback ignored safely
        }
      }
    }

    // Build distinct search term list
    const searchTermsList = [query];
    if (englishQuery && englishQuery.toLowerCase() !== query.toLowerCase()) {
      searchTermsList.push(englishQuery);
    }

    // Query world.openfoodfacts.org and tw.openfoodfacts.org in parallel
    const fetchPromises: Promise<any[]>[] = [];

    for (const term of searchTermsList) {
      const worldUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
        term
      )}&search_simple=1&action=process&json=1&page_size=30`;

      fetchPromises.push(
        fetch(worldUrl, {
          headers: { 'User-Agent': 'FitPocketWeb - Version 1.0 - www.fitpocket.app' },
        })
          .then((r) => (r.ok ? r.json() : { products: [] }))
          .then((d) => d.products || [])
          .catch(() => [])
      );

      const twUrl = `https://tw.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
        term
      )}&search_simple=1&action=process&json=1&page_size=20`;

      fetchPromises.push(
        fetch(twUrl, {
          headers: { 'User-Agent': 'FitPocketWeb - Version 1.0 - www.fitpocket.app' },
        })
          .then((r) => (r.ok ? r.json() : { products: [] }))
          .then((d) => d.products || [])
          .catch(() => [])
      );
    }

    const batches = await Promise.all(fetchPromises);
    const codeMap = new Map<string, any>();

    for (const batch of batches) {
      for (const p of batch) {
        if (!p || !p.code) continue;
        if (!codeMap.has(p.code)) {
          codeMap.set(p.code, p);
        } else {
          const existing = codeMap.get(p.code);
          if (!existing.image_url && p.image_url) {
            existing.image_url = p.image_url;
            existing.image_front_small_url = p.image_front_small_url;
          }
          if (!existing.product_name_zh && p.product_name_zh) {
            existing.product_name_zh = p.product_name_zh;
          }
        }
      }
    }

    const products = Array.from(codeMap.values())
      .map((p: any) => ({
        id: `off_${p.code}`,
        name: p.product_name_zh || p.product_name || p.generic_name || '未知商品',
        brand: p.brands || 'Open Food Facts',
        caloriesPer100g: parseFloat(p.nutriments?.['energy-kcal_100g'] || p.nutriments?.['energy-kcal'] || 0),
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
      }))
      .filter((p) => p.name && p.name !== '未知商品');

    // Prioritize products with images and calorie information
    products.sort((a, b) => {
      const scoreA = (a.imageUrl ? 2 : 0) + (a.caloriesPer100g > 0 ? 1 : 0);
      const scoreB = (b.imageUrl ? 2 : 0) + (b.caloriesPer100g > 0 ? 1 : 0);
      return scoreB - scoreA;
    });

    res.json({ products: products.slice(0, 45) });
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
