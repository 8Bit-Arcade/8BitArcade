'use client';

import { useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';

export default function WalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { address, isConnected, isConnecting } = useAccount();
  const {
    setConnected,
    setAddress,
    getUsername,
    setIsNewUser,
    setLoading,
    reset: resetAuth,
  } = useAuthStore();
  const { setUsernameModalOpen, addToast } = useUIStore();

  // Track if we've already shown the modal for this session
  const hasShownModal = useRef(false);
  const prevAddress = useRef<string | null>(null);

  // Handle connection state changes
  useEffect(() => {
    setConnected(isConnected);
    setLoading(isConnecting);

    if (isConnected && address) {
      setAddress(address);

      // Only check for username when address changes or first connection
      if (prevAddress.current !== address) {
        prevAddress.current = address;
        hasShownModal.current = false;
      }

      const existingUsername = getUsername(address);

      if (!existingUsername && !hasShownModal.current) {
        setIsNewUser(true);
        hasShownModal.current = true;
        // Delay modal to allow wallet modal to close
        setTimeout(() => {
          setUsernameModalOpen(true);
        }, 500);
      } else if (existingUsername && !hasShownModal.current) {
        hasShownModal.current = true;

        // Auto-sync username from localStorage to Firestore if not already there
        (async () => {
          try {
            const { getFirestoreInstance, isFirebaseConfigured } = await import('@/lib/firebase-client');
            if (isFirebaseConfigured()) {
              const [db, { doc, getDoc, setDoc, serverTimestamp }] = await Promise.all([
                getFirestoreInstance(),
                import('firebase/firestore'),
              ]);

              const userRef = doc(db, 'users', address.toLowerCase());
              const userDoc = await getDoc(userRef);

              // If username exists in localStorage but not in Firestore, sync it
              if (!userDoc.exists() || !userDoc.data()?.username) {
                await setDoc(userRef, {
                  username: existingUsername,
                  address: address.toLowerCase(),
                  createdAt: serverTimestamp(),
                  lastActive: serverTimestamp(),
                }, { merge: true });

                console.log('✅ Synced username to Firestore:', existingUsername);
              } else {
                // Update lastActive timestamp
                await setDoc(userRef, {
                  lastActive: serverTimestamp(),
                }, { merge: true });
              }
            }
          } catch (err) {
            console.error('Failed to sync username to Firestore:', err);
          }
        })();

        addToast({
          type: 'success',
          message: `Welcome back, ${existingUsername}!`,
        });
      }
    } else if (!isConnected) {
      prevAddress.current = null;
      hasShownModal.current = false;
      resetAuth();
    }
  }, [
    isConnected,
    isConnecting,
    address,
    setConnected,
    setAddress,
    getUsername,
    setIsNewUser,
    setLoading,
    setUsernameModalOpen,
    addToast,
    resetAuth,
  ]);

  return <>{children}</>;
}
