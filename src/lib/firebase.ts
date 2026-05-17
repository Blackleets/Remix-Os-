import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, GithubAuthProvider, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// App Check — anti-abuse shield in front of Firestore/Storage/Auth. It is a
// strict no-op until VITE_RECAPTCHA_SITE_KEY is set, so local dev and the
// current production deploy keep working unchanged. To enable: register a
// reCAPTCHA v3 site key in the Firebase console (App Check) and set the env
// var. For local debugging, set VITE_APPCHECK_DEBUG=true and register the
// printed debug token in the console.
const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;
if (recaptchaSiteKey) {
  try {
    if (import.meta.env.VITE_APPCHECK_DEBUG === 'true') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.error('[AppCheck] initialization failed (continuing without it):', err);
  }
}
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
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

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

// Removed top-level call to avoid early permission errors before auth is ready.
// testConnection();
