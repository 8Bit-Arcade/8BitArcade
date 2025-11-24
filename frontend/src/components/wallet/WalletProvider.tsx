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
