import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged, User, GoogleAuthProvider as GAuthProvider } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const isProduction = typeof window !== 'undefined' && 
  !window.location.hostname.includes('localhost') && 
  !window.location.hostname.includes('127.0.0.1') && 
  !window.location.hostname.includes('ais-dev-') && 
  !window.location.hostname.includes('ais-pre-');

const dynamicFirebaseConfig = {
  ...firebaseConfig,
  authDomain: isProduction ? window.location.host : firebaseConfig.authDomain
};

const app = initializeApp(dynamicFirebaseConfig);

// Initialize Firestore with fallback support:
// If firestoreDatabaseId is set, test/use it; if empty or if default is preferred, fall back gracefully
export const db = firebaseConfig.firestoreDatabaseId 
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const defaultDb = getFirestore(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Add Drive scope
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

// Helper to test Firebase Firestore read/write connection
export const testFirebaseConnection = async (): Promise<{ 
  success: boolean; 
  latencyMs: number; 
  message: string; 
  details?: any;
}> => {
  const startTime = performance.now();
  const { doc, setDoc, getDoc, deleteDoc } = await import('firebase/firestore');

  // Attempt test on a specific database instance
  const runTestOnInstance = async (targetDb: any, dbLabel: string) => {
    const testDocId = `ping_${Date.now()}`;
    const testRef = doc(targetDb, '_connection_test', testDocId);
    
    // Test write with 6 second timeout
    const writePromise = setDoc(testRef, { timestamp: Date.now(), ping: 'pong', target: dbLabel });
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`連線逾時 (6秒)：無法連線至 Firestore [${dbLabel}]`)), 6000)
    );
    await Promise.race([writePromise, timeoutPromise]);
    
    // Test read
    const snap = await getDoc(testRef);
    if (!snap.exists()) {
      throw new Error(`Firestore 測試文件寫入後無法讀取 [${dbLabel}]`);
    }
    
    // Clean up test doc
    await deleteDoc(testRef).catch(() => {});
  };

  try {
    const configuredDbId = firebaseConfig.firestoreDatabaseId || '(default)';
    await runTestOnInstance(db, configuredDbId);
    
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      success: true,
      latencyMs,
      message: `Firebase Firestore 連線成功！延遲: ${latencyMs}ms`,
      details: {
        databaseId: configuredDbId,
        projectId: firebaseConfig.projectId,
      }
    };
  } catch (err: any) {
    const primaryError = err;
    console.error('[Firebase Diagnostic Primary Error]', primaryError);

    // If a custom databaseId failed, attempt fallback check on default database (default)
    let fallbackResult: { success: boolean; error?: any } = { success: false };
    if (firebaseConfig.firestoreDatabaseId) {
      try {
        await runTestOnInstance(defaultDb, '(default)');
        fallbackResult = { success: true };
      } catch (fbErr: any) {
        fallbackResult = { success: false, error: fbErr };
      }
    }

    const latencyMs = Math.round(performance.now() - startTime);
    let userMsg = primaryError?.message || 'Firebase 連線失敗';
    
    if (primaryError?.code === 'permission-denied') {
      userMsg = '權限遭拒 (permission-denied)：Firestore 安全規則拒絕存取。請確認 Rules 是否已部署生效。';
    } else if (primaryError?.code === 'unavailable') {
      userMsg = '服務無法連線 (unavailable)：網路無法連線或 Firebase 尚未完成建立。';
    } else if (primaryError?.code === 'not-found' || (primaryError?.message && primaryError.message.includes('not found'))) {
      userMsg = `指定的命名資料庫未找到 [${firebaseConfig.firestoreDatabaseId}]。${fallbackResult.success ? '（但 (default) 預設資料庫連線正常，可切換至預設資料庫）' : ''}`;
    }

    return {
      success: false,
      latencyMs,
      message: userMsg,
      details: {
        code: primaryError?.code || 'UNKNOWN',
        name: primaryError?.name,
        rawMessage: primaryError?.message,
        databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
        projectId: firebaseConfig.projectId,
        defaultDbTestSuccess: fallbackResult.success,
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
        console.log("Successfully loaded redirected Google Access Token.");
      }
    }
  } catch (error) {
    console.error("Redirect login resolution error:", error);
  }
};

export const loginWithGoogle = async (forceSelectAccount = false, forceMethod?: 'popup' | 'redirect') => {
  try {
    googleProvider.setCustomParameters({ prompt: 'select_account' }); // Always force select account to ensure we can switch
    
    // Detect mobile browser to automatically switch to redirect mode (bypasses third-party popup cookie blocks)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const useRedirect = forceMethod === 'redirect' || (forceMethod !== 'popup' && isMobile);
    
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
      }
      return { user: result.user, accessToken: cachedAccessToken, isRedirecting: false };
    }
  } catch (error) {
    console.error("Login failed:", error);
    throw error;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    cachedAccessToken = localStorage.getItem('fitpocket_google_access_token');
  }
  return cachedAccessToken;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
  localStorage.removeItem('fitpocket_google_access_token');
};

// Error handling for Firestore
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

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
