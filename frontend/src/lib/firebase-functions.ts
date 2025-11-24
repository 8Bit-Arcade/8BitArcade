// Firebase Functions with FULLY dynamic imports to avoid bundling undici
// This file should NEVER be imported at the top level of client components
// All Firebase modules are loaded dynamically at runtime only

let functionsInstance: any = null;
let functionsPromise: Promise<any> | null = null;

/**
 * Initialize Firebase app dynamically (no static imports)
 */
async function getFirebaseApp() {
  const { initializeApp, getApps } = await import('firebase/app');

  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  return initializeApp(firebaseConfig);
}

/**
 * Lazily load Firebase Functions - only imports firebase/functions at runtime
 */
export async function getFirebaseFunctions(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('Firebase Functions can only be used in the browser');
  }

  if (functionsInstance) {
    return functionsInstance;
  }

  if (functionsPromise) {
    return functionsPromise;
  }

  functionsPromise = (async () => {
    // Dynamic imports - only loads at runtime, not build time
    const [{ getFunctions, connectFunctionsEmulator }, app] = await Promise.all([
      import('firebase/functions'),
      getFirebaseApp(),
    ]);

    functionsInstance = getFunctions(app);

    // Connect to emulator if configured
    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true') {
      connectFunctionsEmulator(functionsInstance, 'localhost', 5001);
    }

    return functionsInstance;
  })();

  return functionsPromise;
}

/**
 * Call a Firebase Function - handles dynamic import internally
 */
export async function callFunction<T = any, R = any>(
  functionName: string,
  data: T
): Promise<R> {
  const [{ httpsCallable }, functions] = await Promise.all([
    import('firebase/functions'),
    getFirebaseFunctions(),
  ]);

  const fn = httpsCallable<T, R>(functions, functionName);
  const result = await fn(data);
  return result.data;
}
