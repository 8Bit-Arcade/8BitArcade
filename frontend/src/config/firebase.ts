// frontend/src/config/firebase.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase config with hardcoded fallbacks for static export builds
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBqFKw6v6RB0P1HHup9jO10Cziqfnuiig4",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "bitarcade-679b7.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "bitarcade-679b7",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "bitarcade-679b7.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "163469341654",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:163469341654:web:f5e231834fa4426a396a77",
};

// Initialize Firebase app (reuse existing if already initialized)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Export Firestore instance
export const db = getFirestore(app);
