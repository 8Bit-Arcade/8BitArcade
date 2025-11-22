'use client';

import { useEffect } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';

export default function WalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { address, isConnected, isConnecting } = useAccount();
  const { disconnect } = useDisconnect();
  const {
    setConnected,
    setAddress,
    username,
    setIsNewUser,
    setLoading,
    reset: resetAuth,
  } = useAuthStore();
  const { setUsernameModalOpen, addToast } = useUIStore();

  // Handle connection state changes
  useEffect(() => {
    setConnected(isConnected);
    setLoading(isConnecting);

    if (isConnected && address) {
      setAddress(address);

      // Check if this is a new user (no username set)
      // In production, this would check Firebase
      if (!username) {
        setIsNewUser(true);
        // Delay modal to allow wallet modal to close
        setTimeout(() => {
          setUsernameModalOpen(true);
        }, 500);
      } else {
        addToast({
          type: 'success',
          message: `Welcome back, ${username}!`,
        });
      }
    } else if (!isConnected) {
      resetAuth();
    }
  }, [
    isConnected,
    isConnecting,
    address,
    username,
    setConnected,
    setAddress,
    setIsNewUser,
    setLoading,
    setUsernameModalOpen,
    addToast,
    resetAuth,
  ]);

  // Handle network errors
  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      if (error.message?.includes('wallet') || error.message?.includes('Web3')) {
        addToast({
          type: 'error',
          message: 'Wallet connection error. Please try again.',
        });
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, [addToast]);

  return <>{children}</>;
}
