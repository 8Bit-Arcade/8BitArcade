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

  // Firebase config - hardcoded with fallback to env vars for static export builds
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBqFKw6v6RB0P1HHup9jO10Cziqfnuiig4",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "bitarcade-679b7.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "bitarcade-679b7",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "bitarcade-679b7.firebasestorage.app",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "163469341654",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:163469341654:web:f5e231834fa4426a396a77",
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
