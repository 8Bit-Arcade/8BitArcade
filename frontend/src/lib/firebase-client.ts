// Client-only Firebase configuration with FULLY dynamic imports
// This prevents ANY Firebase code from being bundled at build time
// NEVER import firebase/auth or firebase/firestore at the top level

let firebaseInitialized = false;
let appInstance: any = null;

/**
 * Check if Firebase is configured
 * Always returns true since we have hardcoded fallback values
 */
export function isFirebaseConfigured(): boolean {
  if (typeof window === 'undefined') return false;

  // Always configured - we have hardcoded fallback values
  return true;
}

/**
 * Initialize Firebase app (lazy, client-side only)
 */
async function initializeFirebaseApp() {
  if (appInstance) return appInstance;

  // Dynamic import - only loads at runtime
  const { initializeApp, getApps } = await import('firebase/app');

  const apps = getApps();
  if (apps.length > 0) {
    appInstance = apps[0];
    return appInstance;
  }

  // Firebase config - hardcoded with fallback to env vars for static export builds
  // These values are already public in Firebase-config.txt
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBqFKw6v6RB0P1HHup9jO10Cziqfnuiig4",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "bitarcade-679b7.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "bitarcade-679b7",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "bitarcade-679b7.firebasestorage.app",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "163469341654",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:163469341654:web:f5e231834fa4426a396a77",
  };

  appInstance = initializeApp(firebaseConfig);
  firebaseInitialized = true;
  return appInstance;
}

/**
 * Export Firebase app getter for external use
 */
export const getFirebaseApp = initializeFirebaseApp;

/**
 * Get Firestore instance (lazy, client-side only)
 */
export async function getFirestoreInstance() {
  if (typeof window === 'undefined') {
    throw new Error('Firestore can only be used in the browser');
  }

  const app = await initializeFirebaseApp();

  // Dynamic import
  const { getFirestore, connectFirestoreEmulator } = await import('firebase/firestore');
  const db = getFirestore(app);

  // Connect to emulator if configured (only once)
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' && !firebaseInitialized) {
    try {
      connectFirestoreEmulator(db, 'localhost', 8080);
    } catch (e) {
      // Already connected
    }
  }

  return db;
}

/**
 * Get Auth instance (lazy, client-side only)
 */
export async function getAuthInstance() {
  if (typeof window === 'undefined') {
    throw new Error('Auth can only be used in the browser');
  }

  const app = await initializeFirebaseApp();

  // Dynamic import
  const { getAuth, connectAuthEmulator } = await import('firebase/auth');
  const auth = getAuth(app);

  // Connect to emulator if configured (only once)
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' && !firebaseInitialized) {
    try {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    } catch (e) {
      // Already connected
    }
  }

  return auth;
}

/**
 * Export Firestore methods with dynamic imports
 */
export async function firestoreQuery(
  collectionPath: string,
  ...queryConstraints: any[]
) {
  const db = await getFirestoreInstance();
  const { collection, query } = await import('firebase/firestore');
  return query(collection(db, collectionPath), ...queryConstraints);
}

export async function firestoreDoc(docPath: string, ...pathSegments: string[]) {
  const db = await getFirestoreInstance();
  const { doc } = await import('firebase/firestore');
  return doc(db, docPath, ...pathSegments);
}
