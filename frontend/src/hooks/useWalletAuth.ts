import { useEffect, useCallback, useState, useRef } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { callFunction } from '@/lib/firebase-functions';
import { useAuthStore } from '@/stores/authStore';

/**
 * Sync username from localStorage to Firestore (called after Firebase auth)
 */
async function syncUsernameToFirestore(address: string): Promise<void> {
  try {
    // Get username from localStorage
    const users = useAuthStore.getState().users;
    const existingUsername = users[address.toLowerCase()]?.username;

    if (!existingUsername) {
      return; // No username to sync
    }

    const { getFirestoreInstance, isFirebaseConfigured } = await import('@/lib/firebase-client');
    if (!isFirebaseConfigured()) {
      return;
    }

    const [db, { doc, getDoc, setDoc, serverTimestamp }] = await Promise.all([
      getFirestoreInstance(),
      import('firebase/firestore'),
    ]);

    const userRef = doc(db, 'users', address.toLowerCase());
    const userDoc = await getDoc(userRef);

    // Only sync if username doesn't exist in Firestore
    if (!userDoc.exists() || !userDoc.data()?.username) {
      await setDoc(userRef, {
        username: existingUsername,
        address: address.toLowerCase(),
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
      }, { merge: true });

      console.log('✅ Synced username to Firestore:', existingUsername);
    } else {
      // Just update lastActive
      await setDoc(userRef, {
        lastActive: serverTimestamp(),
      }, { merge: true });
    }
  } catch (err) {
    console.error('Failed to sync username to Firestore:', err);
  }
}

/**
 * Hook to handle wallet-based Firebase authentication
 * Automatically signs in to Firebase when wallet is connected
 */
export function useWalletAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isFirebaseAuthenticated, setIsFirebaseAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAttemptedAuth = useRef(false);
  const userRejected = useRef(false);

  /**
   * Sign in to Firebase using the connected wallet
   */
  const signInWithWallet = useCallback(async () => {
    if (!address || !isConnected) {
      setError('No wallet connected');
      return false;
    }

    if (hasAttemptedAuth.current || userRejected.current) {
      return false;
    }

    hasAttemptedAuth.current = true;
    setIsAuthenticating(true);
    setError(null);

    try {
      // Create a message to sign
      const timestamp = Date.now();
      const nonce = Math.random().toString(16).substring(2);
      const message = `Sign in to 8-Bit Arcade\n\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

      // Request signature from wallet
      const signature = await signMessageAsync({ message });

      // Verify signature and get custom token from Firebase Function
      const { customToken } = await callFunction<any, { customToken: string }>(
        'verifyWallet',
        {
          address,
          message,
          signature,
        }
      );

      // Sign in to Firebase with the custom token
      const { getFirebaseApp } = await import('@/lib/firebase-client');
      await getFirebaseApp(); // Ensure Firebase is initialized

      const auth = getAuth();
      await signInWithCustomToken(auth, customToken);

      setIsFirebaseAuthenticated(true);
      userRejected.current = false;
      console.log('✅ Signed in to Firebase with wallet:', address);

      // Sync username from localStorage to Firestore after successful auth
      await syncUsernameToFirestore(address);

      return true;
    } catch (err: any) {
      console.error('Failed to authenticate with wallet:', err);

      // Check if user rejected the signature
      if (err.message?.includes('User rejected') || err.message?.includes('User denied')) {
        userRejected.current = true;
        setError('Signature rejected. You need to sign in to play ranked games.');
      } else {
        setError(err.message || 'Authentication failed');
      }

      setIsFirebaseAuthenticated(false);
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, isConnected, signMessageAsync]);

  /**
   * Check if currently authenticated with Firebase
   */
  const checkAuthStatus = useCallback(async () => {
    try {
      const { getFirebaseApp } = await import('@/lib/firebase-client');
      await getFirebaseApp();

      const auth = getAuth();
      const user = auth.currentUser;

      if (user && address) {
        // Verify the Firebase user UID matches the wallet address
        const isMatch = user.uid.toLowerCase() === address.toLowerCase();
        setIsFirebaseAuthenticated(isMatch);
        return isMatch;
      }

      setIsFirebaseAuthenticated(false);
      return false;
    } catch (err) {
      setIsFirebaseAuthenticated(false);
      return false;
    }
  }, [address]);

  /**
   * Reset flags when wallet address changes
   */
  useEffect(() => {
    hasAttemptedAuth.current = false;
    userRejected.current = false;
    setIsFirebaseAuthenticated(false);
  }, [address]);

  /**
   * Check auth status when wallet connects
   */
  useEffect(() => {
    if (isConnected && address && !isAuthenticating) {
      checkAuthStatus();
    }
  }, [isConnected, address, checkAuthStatus, isAuthenticating]);

  /**
   * Sign out when wallet disconnects
   */
  useEffect(() => {
    if (!isConnected && isFirebaseAuthenticated) {
      (async () => {
        try {
          const { getFirebaseApp } = await import('@/lib/firebase-client');
          await getFirebaseApp();
          const auth = getAuth();
          await auth.signOut();
          setIsFirebaseAuthenticated(false);
          hasAttemptedAuth.current = false;
          userRejected.current = false;
          console.log('✅ Signed out from Firebase');
        } catch (err) {
          console.error('Failed to sign out:', err);
        }
      })();
    }
  }, [isConnected, isFirebaseAuthenticated]);

  return {
    signInWithWallet,
    isAuthenticating,
    isFirebaseAuthenticated,
    error,
  };
}
