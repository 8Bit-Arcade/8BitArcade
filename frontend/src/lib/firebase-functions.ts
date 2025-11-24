// Separate file for Firebase Functions - uses dynamic imports to avoid bundling undici
// This file should NEVER be imported at the top level of client components
// DO NOT add any imports from 'firebase/functions' here - not even type imports!

let functionsInstance: any = null;
let functionsPromise: Promise<any> | null = null;

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
    // Dynamic import - only loads at runtime, not build time
    const [{ getFunctions, connectFunctionsEmulator }, { app }] = await Promise.all([
      import('firebase/functions'),
      import('./firebase'),
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
