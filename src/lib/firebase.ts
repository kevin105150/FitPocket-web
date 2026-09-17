import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, User, GoogleAuthProvider as GAuthProvider } from 'firebase/auth';
import rawFirebaseConfig from '../../firebase-applet-config.json';

const configAny = rawFirebaseConfig as any;

// Guaranteed fallback config for standalone deployments (Render / Vercel / Cloud Run / GitHub Actions)
export const FIREBASE_PROJECT_ID = configAny?.projectId || 'quirky-gear-l0w9t';
export const FIRESTORE_DATABASE_ID = configAny?.firestoreDatabaseId || 'ai-studio-aidiettrackerapp-767063f9-4fee-46bc-9161-8aaabc23bda9';
export const FIREBASE_API_KEY = configAny?.apiKey || '';

export const firebaseConfig = {
  ...configAny,
  projectId: FIREBASE_PROJECT_ID,
  firestoreDatabaseId: FIRESTORE_DATABASE_ID,
  authDomain: configAny?.authDomain || `${FIREBASE_PROJECT_ID}.firebaseapp.com`,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore targeting the exact database instance
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  }, FIRESTORE_DATABASE_ID);
} catch {
  firestoreInstance = getFirestore(app, FIRESTORE_DATABASE_ID);
}

export const db = firestoreInstance;

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Add Drive scope
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

// Helper to test Firebase Firestore connection via standard REST & SDK
export const testFirebaseConnection = async (): Promise<{ 
  success: boolean; 
  latencyMs: number; 
  message: string; 
  details?: any;
}> => {
  const startTime = performance.now();
  const configuredDbId = firebaseConfig.firestoreDatabaseId || '(default)';
  const testDocId = `ping_${Date.now()}`;
  
  // 1. Direct REST diagnostic test (100% reliable across mobile carriers & proxies)
  const restUrl = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${configuredDbId}/documents/_connection_test/${testDocId}?key=${firebaseConfig.apiKey}`;

  try {
    // Write test document via REST API
    const writeRes = await fetch(restUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          ping: { stringValue: 'pong' },
          timestamp: { integerValue: String(Date.now()) },
          target: { stringValue: configuredDbId },
          client: { stringValue: 'FitPocket Diagnostic' }
        }
      })
    });

    if (!writeRes.ok) {
      const errData = await writeRes.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `HTTP ${writeRes.status}: 寫入測試失敗`);
    }

    // Read test document back via REST API
    const readRes = await fetch(restUrl);
    if (!readRes.ok) {
      const errData = await readRes.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `HTTP ${readRes.status}: 讀取測試失敗`);
    }

    // Clean up test document
    fetch(restUrl, { method: 'DELETE' }).catch(() => {});

    const latencyMs = Math.round(performance.now() - startTime);
    return {
      success: true,
      latencyMs,
      message: `Firebase Firestore 雲端資料庫連線正常！反應時間: ${latencyMs}ms`,
      details: {
        databaseId: configuredDbId,
        projectId: firebaseConfig.projectId,
        protocol: 'HTTPS REST / Firestore v1 API',
      }
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    console.error('[Firebase Diagnostic Error]', err);

    let userMsg = err?.message || 'Firebase 連線失敗';
    if (userMsg.includes('permission') || userMsg.includes('PERMISSION_DENIED') || err?.code === 'permission-denied') {
      userMsg = '權限遭拒 (permission-denied)：Firestore 安全規則拒絕存取。請確認 Rules 是否已部署。';
    } else if (userMsg.includes('NOT_FOUND') || userMsg.includes('not found')) {
      userMsg = `資料庫未找到 [${configuredDbId}]。`;
    }

    return {
      success: false,
      latencyMs,
      message: userMsg,
      details: {
        code: err?.code || 'UNKNOWN',
        name: err?.name,
        rawMessage: err?.message,
        databaseId: configuredDbId,
        projectId: firebaseConfig.projectId,
      }
    };
  }
};

// Cache access token in memory and localStorage for persistent sessions
let cachedAccessToken: string | null = localStorage.getItem('fitpocket_google_access_token');

export const handleRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    if (result) {
      const credential = GAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        localStorage.setItem('fitpocket_google_access_token', credential.accessToken);
        localStorage.setItem('fitpocket_google_token_time', Date.now().toString());
        console.log("Successfully loaded redirected Google Access Token with timestamp.");
      }
    }
  } catch (error) {
    console.error("Redirect login resolution error:", error);
  }
};

export const loginWithGoogle = async (forceSelectAccount = false, forceMethod?: 'popup' | 'redirect') => {
  try {
    googleProvider.setCustomParameters({ prompt: 'select_account' }); // Always force select account to ensure we can switch
    
    // Default to popup as requested, even on mobile. 
    // Only use redirect if explicitly passed as 'redirect'.
    const useRedirect = forceMethod === 'redirect';
    
    if (useRedirect) {
      console.log("Launching Google Sign-In with Redirect...");
      await signInWithRedirect(auth, googleProvider);
      return { user: null, accessToken: null, isRedirecting: true };
    } else {
      console.log("Launching Google Sign-In with Popup...");
      const result = await signInWithPopup(auth, googleProvider);
      const credential = GAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        cachedAccessToken = credential.accessToken;
        localStorage.setItem('fitpocket_google_access_token', credential.accessToken);
        localStorage.setItem('fitpocket_google_token_time', Date.now().toString());
      }
      return { user: result.user, accessToken: cachedAccessToken, isRedirecting: false };
    }
  } catch (error: any) {
    // If popup is blocked, we might want to fallback to redirect automatically if it was an automated call,
    // but since the user explicitly asked for popup default, we'll just log it.
    if (error?.code === 'auth/popup-blocked') {
      console.warn("Popup blocked. User might need to allow popups or use redirect manually.");
    }
    console.error("Login failed:", error);
    throw error;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  const token = localStorage.getItem('fitpocket_google_access_token');
  const timeStr = localStorage.getItem('fitpocket_google_token_time');
  if (!token || !timeStr) {
    return null;
  }
  
  const tokenTime = parseInt(timeStr, 10);
  const elapsed = Date.now() - tokenTime;
  if (elapsed > 55 * 60 * 1000) { // 55 minutes
    console.log("Token expired according to timestamp cache. Clearing...");
    clearGoogleAccessToken();
    return null;
  }
  
  cachedAccessToken = token;
  return cachedAccessToken;
};

export const clearGoogleAccessToken = () => {
  cachedAccessToken = null;
  localStorage.removeItem('fitpocket_google_access_token');
  localStorage.removeItem('fitpocket_google_token_time');
};

export const logout = async () => {
  await signOut(auth);
  clearGoogleAccessToken();
};

// Error handling for Firestore
export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;

export type OperationType = typeof OperationType[keyof typeof OperationType];

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Listener to clear token on logout
onAuthStateChanged(auth, (user) => {
  if (!user) {
    cachedAccessToken = null;
  }
});
