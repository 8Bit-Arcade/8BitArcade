// Client-only Firebase configuration with FULLY dynamic imports
// This prevents ANY Firebase code from being bundled at build time
// NEVER import firebase/auth or firebase/firestore at the top level

let firebaseInitialized = false;
let appInstance: any = null;

/**
 * Check if Firebase is configured
 */
export function isFirebaseConfigured(): boolean {
  if (typeof window === 'undefined') return false;

  return !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  );
}

/**
 * Initialize Firebase app (lazy, client-side only)
 */
async function initializeFirebaseApp() {
  if (appInstance) return appInstance;
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured');
  }

  // Dynamic import - only loads at runtime
  const { initializeApp, getApps } = await import('firebase/app');

  const apps = getApps();
  if (apps.length > 0) {
    appInstance = apps[0];
    return appInstance;
  }

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  appInstance = initializeApp(firebaseConfig);
  firebaseInitialized = true;
  return appInstance;
}

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
