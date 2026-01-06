import { useEffect, useCallback, useState, useRef } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import { callFunction } from '@/lib/firebase-functions';
import { useAuthStore } from '@/stores/authStore';
import { createSimpleSignatureMessage } from '@/lib/signatureMessages';

/**
 * Sync username from localStorage to Firestore (called after Firebase auth)
 */
async function syncUsernameToFirestore(address: string): Promise<void> {
  try {
    const users = useAuthStore.getState().users;
    const existingUsername = users[address.toLowerCase()]?.username;

    if (!existingUsername) return;

    const { getFirestoreInstance, isFirebaseConfigured } = await import('@/lib/firebase-client');
    if (!isFirebaseConfigured()) return;

    const [db, { doc, getDoc, setDoc, serverTimestamp }] = await Promise.all([
      getFirestoreInstance(),
      import('firebase/firestore'),
    ]);

    const userRef = doc(db, 'users', address.toLowerCase());
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists() || !userDoc.data()?.username) {
      await setDoc(
        userRef,
        {
          username: existingUsername,
          address: address.toLowerCase(),
          createdAt: serverTimestamp(),
          lastActive: serverTimestamp(),
        },
        { merge: true }
      );
      console.log('✅ Synced username to Firestore:', existingUsername);
    } else {
      await setDoc(userRef, { lastActive: serverTimestamp() }, { merge: true });
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

  const signInWithWallet = useCallback(async () => {
    if (!address || !isConnected) {
      setError('No wallet connected');
      return false;
    }

    if (hasAttemptedAuth.current || userRejected.current) return false;

    hasAttemptedAuth.current = true;
    setIsAuthenticating(true);
    setError(null);

    try {
      const { message } = createSimpleSignatureMessage('sign_in', address);
      const signature = await signMessageAsync({ message });

      // Call the deployed Firebase Function
      const { customToken } = await callFunction<any, { customToken: string }>(
        'verifyWallet',
        { address, message, signature }
      );

      // Sign in to Firebase with the custom token
      const { getFirebaseApp } = await import('@/lib/firebase-client');
      await getFirebaseApp();
      const auth = getAuth();
      await signInWithCustomToken(auth, customToken);

      setIsFirebaseAuthenticated(true);
      userRejected.current = false;
      console.log('✅ Signed in to Firebase with wallet:', address);

      await syncUsernameToFirestore(address);
      return true;
    } catch (err: any) {
      console.error('Failed to authenticate with wallet:', err);

      if (err.message?.includes('User rejected') || err.message?.includes('User denied')) {
        userRejected.current = true;
        setError('Signature rejected. You need to sign in to play ranked games.');
      } else if (err.message?.includes('Message has expired')) {
        setError('Your wallet message has expired. Please try again.');
      } else {
        setError(err.message || 'Authentication failed');
      }

      setIsFirebaseAuthenticated(false);
      return false;
    } finally {
      setIsAuthenticating(false);
    }
  }, [address, isConnected, signMessageAsync]);

  const checkAuthStatus = useCallback(async () => {
    try {
      const { getFirebaseApp } = await import('@/lib/firebase-client');
      await getFirebaseApp();

      const auth = getAuth();
      const user = auth.currentUser;

      const isMatch = !!user && !!address && user.uid.toLowerCase() === address.toLowerCase();
      setIsFirebaseAuthenticated(isMatch);
      return isMatch;
    } catch {
      setIsFirebaseAuthenticated(false);
      return false;
    }
  }, [address]);

  useEffect(() => {
    hasAttemptedAuth.current = false;
    userRejected.current = false;
    setIsFirebaseAuthenticated(false);
  }, [address]);

  useEffect(() => {
    if (isConnected && address && !isAuthenticating) checkAuthStatus();
  }, [isConnected, address, checkAuthStatus, isAuthenticating]);

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

  return { signInWithWallet, isAuthenticating, isFirebaseAuthenticated, error };
}
