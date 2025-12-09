'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAccount, useEnsName } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';

export default function WalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { address, isConnected, isConnecting } = useAccount();
  const { data: ensName } = useEnsName({
    address: address as `0x${string}` | undefined,
    chainId: mainnet.id,
  });

  const {
    setConnected,
    setAddress,
    setEnsName,
    getUsername,
    getEnsName,
    setIsNewUser,
    setLoading,
    reset: resetAuth,
  } = useAuthStore();
  const { setUsernameModalOpen, addToast } = useUIStore();

  // Track if we've already shown the modal for this session
  const hasShownModal = useRef(false);
  const prevAddress = useRef<string | null>(null);
  const hasLoadedFromFirestore = useRef(false);

  // Load user data from Firestore if not in localStorage
  const loadUserFromFirestore = useCallback(async (address: string) => {
    try {
      const { getFirestoreInstance, isFirebaseConfigured } = await import('@/lib/firebase-client');
      if (!isFirebaseConfigured()) return;

      const [db, { doc, getDoc }] = await Promise.all([
        getFirestoreInstance(),
        import('firebase/firestore'),
      ]);

      const userRef = doc(db, 'users', address.toLowerCase());
      const userDoc = await getDoc(userRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        const { setUsername, setDisplayPreference } = useAuthStore.getState();

        // Update localStorage with Firestore data
        if (data.username) {
          setUsername(address, data.username);
          console.log('✅ Loaded username from Firestore:', data.username);
        }
        if (data.displayPreference) {
          setDisplayPreference(address, data.displayPreference);
        }
      }
    } catch (err) {
      console.error('Failed to load user data from Firestore:', err);
    }
  }, []);

  // Save ENS name when fetched
  useEffect(() => {
    if (address && ensName) {
      setEnsName(address, ensName);
      console.log('✅ ENS name resolved:', ensName, 'for', address);
    }
  }, [address, ensName, setEnsName]);

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
        hasLoadedFromFirestore.current = false;
      }

      // Check localStorage first, then try Firestore
      const checkUsername = async () => {
        let existingUsername = getUsername(address);
        const existingEnsName = getEnsName(address);

        // If no username in localStorage, try loading from Firestore
        if (!existingUsername && !hasLoadedFromFirestore.current) {
          hasLoadedFromFirestore.current = true;
          await loadUserFromFirestore(address);
          // Re-check after Firestore load
          existingUsername = getUsername(address);
        }

        if (!existingUsername && !hasShownModal.current) {
          setIsNewUser(true);
          hasShownModal.current = true;
          // Delay modal to allow wallet modal to close
          setTimeout(() => {
            setUsernameModalOpen(true);
          }, 500);
        } else if ((existingUsername || existingEnsName) && !hasShownModal.current) {
          hasShownModal.current = true;
          const displayName = existingEnsName || existingUsername;
          addToast({
            type: 'success',
            message: `Welcome back, ${displayName}!`,
          });
        }
      };

      checkUsername();
    } else if (!isConnected) {
      prevAddress.current = null;
      hasShownModal.current = false;
      hasLoadedFromFirestore.current = false;
      resetAuth();
    }
  }, [
    isConnected,
    isConnecting,
    address,
    setConnected,
    setAddress,
    getUsername,
    getEnsName,
    setIsNewUser,
    setLoading,
    setUsernameModalOpen,
    addToast,
    resetAuth,
    loadUserFromFirestore,
  ]);

  return <>{children}</>;
}
