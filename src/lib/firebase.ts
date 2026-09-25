import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  User,
  GoogleAuthProvider as GAuthProvider,
} from 'firebase/auth';
import rawFirebaseConfig from '../../firebase-applet-config.json';

declare global {
  interface Window {
    google?: any;
  }
}

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

// Helper to load Google Identity Services dynamically
export const loadGsiScript = (): Promise<void> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve();
    if (window.google?.accounts?.oauth2) return resolve();
    const existing = document.getElementById('google-gsi-script');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
};

// Request OAuth Token directly using Google Identity Services
export const requestTokenViaGsi = async (forceSelectAccount = false): Promise<string | null> => {
  await loadGsiScript();
  if (!window.google?.accounts?.oauth2) {
    return null;
  }
  const clientId =
    firebaseConfig.oAuthClientId ||
    (typeof rawFirebaseConfig === 'object' && (rawFirebaseConfig as any).oAuthClientId) ||
    '870931923285-98213jfk7pp6nsrfuvdd52stodij2mqb.apps.googleusercontent.com';

  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file email profile openid',
        prompt: forceSelectAccount ? 'select_account' : '',
        callback: (resp: any) => {
          if (resp.error) {
            console.warn('GSI Auth notice:', resp);
            const errorMsg = resp.error_description || resp.error;
            // Detect if this is likely a popup block or security restriction in iframe
            if (errorMsg.includes('popup') || errorMsg.includes('blocked') || errorMsg.includes('closed')) {
              reject(new Error('POPUP_BLOCKED'));
            } else {
              reject(new Error(errorMsg));
            }
          } else if (resp.access_token) {
            resolve(resp.access_token);
          } else {
            resolve(null);
          }
        },
        error_callback: (err: any) => {
          console.warn('GSI token client notice:', err);
          reject(new Error('POPUP_BLOCKED'));
        },
      });

      // Attempt to request token - this will trigger a popup
      client.requestAccessToken();
      
      // Safety timeout: If no response in 60s, assume it's stuck or blocked
      setTimeout(() => {
        reject(new Error('AUTH_TIMEOUT'));
      }, 60000);
    } catch (e) {
      reject(e);
    }
  });
};

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
          client: { stringValue: 'NutraiFit Diagnostic' }
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

let activeRedirectPromise: Promise<string | null> | null = null;

export const handleRedirectResult = async (): Promise<string | null> => {
  if (activeRedirectPromise) {
    console.log("handleRedirectResult: Already waiting for redirect result, sharing the active promise.");
    return activeRedirectPromise;
  }

  activeRedirectPromise = (async () => {
    try {
      const result = await getRedirectResult(auth);
      if (result) {
        const credential = GAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          localStorage.setItem('fitpocket_google_access_token', credential.accessToken);
          localStorage.setItem('fitpocket_google_token_time', Date.now().toString());
          console.log("Successfully loaded redirected Google Access Token with timestamp.");
          return credential.accessToken;
        }
      }
    } catch (error) {
      console.error("Redirect login resolution error:", error);
    }
    return null;
  })();

  try {
    return await activeRedirectPromise;
  } finally {
    activeRedirectPromise = null;
  }
};

let activeLoginPromise: Promise<{ user: User | null; accessToken: string | null; isRedirecting: boolean }> | null = null;

export const loginWithGoogle = async (forceSelectAccount = false, forceMethod?: 'popup' | 'redirect') => {
  if (activeLoginPromise) {
    console.log("loginWithGoogle: A login operation is already in progress, sharing the active promise.");
    return activeLoginPromise;
  }

  const performLogin = async () => {
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
    const isStudioEnv = typeof window !== 'undefined' && window.location.hostname.includes('run.app');

    try {
      if (forceSelectAccount) {
        googleProvider.setCustomParameters({ prompt: 'select_account' });
      } else {
        googleProvider.setCustomParameters({});
      }
      
      const useRedirect = forceMethod === 'redirect';
      
      if (useRedirect) {
        if (isInIframe) {
          console.warn("Cannot perform redirect auth inside an iframe.");
          throw new Error('PREVIEW_IFRAME_RESTRICTION');
        }
        console.log("Launching Google Sign-In with Redirect...");
        await signInWithRedirect(auth, googleProvider);
        return { user: null, accessToken: null, isRedirecting: true };
      } else {
        console.log("Launching Google Sign-In with Popup...");
        try {
          const result = await signInWithPopup(auth, googleProvider);
          const credential = GAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
            cachedAccessToken = credential.accessToken;
            localStorage.setItem('fitpocket_google_access_token', credential.accessToken);
            localStorage.setItem('fitpocket_google_token_time', Date.now().toString());
          }
          return { user: result.user, accessToken: cachedAccessToken, isRedirecting: false };
        } catch (popupErr: any) {
          const errCode = popupErr?.code || '';
          
          if (errCode === 'auth/popup-closed-by-user' || errCode === 'auth/cancelled-popup-request') {
            console.log("User closed or cancelled the login popup.");
            throw popupErr;
          }

          console.warn("Firebase popup login encountered error, evaluating fallback:", popupErr);

          // Attempt fallback via modern Google Identity Services (GIS) Token Client
          try {
            console.log("Attempting fallback via Google Identity Services Token Client...");
            const gsiToken = await requestTokenViaGsi(forceSelectAccount);
            if (gsiToken) {
              cachedAccessToken = gsiToken;
              localStorage.setItem('fitpocket_google_access_token', gsiToken);
              localStorage.setItem('fitpocket_google_token_time', Date.now().toString());

              try {
                const cred = GAuthProvider.credential(null, gsiToken);
                const userCred = await signInWithCredential(auth, cred);
                return { user: userCred.user, accessToken: gsiToken, isRedirecting: false };
              } catch (credErr) {
                console.warn("Firebase Auth credential link notice:", credErr);
                return { user: auth.currentUser, accessToken: gsiToken, isRedirecting: false };
              }
            }
          } catch (gsiErr: any) {
            console.warn("GSI fallback encountered error:", gsiErr);
            if (gsiErr.message === 'POPUP_BLOCKED') {
               throw new Error('PREVIEW_IFRAME_RESTRICTION');
            }
          }

          if (errCode === 'auth/network-request-failed' || errCode === 'auth/popup-blocked') {
            if (isInIframe || isStudioEnv) {
              throw new Error('PREVIEW_IFRAME_RESTRICTION');
            }
            if (!isInIframe) {
              console.log("Automatically switching to signInWithRedirect...");
              await signInWithRedirect(auth, googleProvider);
              return { user: null, accessToken: null, isRedirecting: true };
            }
          }
          throw popupErr;
        }
      }
    } catch (error: any) {
      if (error.message === 'PREVIEW_IFRAME_RESTRICTION') {
        throw new Error('預覽視窗安全性限制阻擋了 Google 登入。請點擊右上角「在新分頁中開啟 (Open in new tab)」後重新進行登入。');
      }
      throw error;
    }
  };


  activeLoginPromise = performLogin();
  try {
    return await activeLoginPromise;
  } finally {
    activeLoginPromise = null;
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
