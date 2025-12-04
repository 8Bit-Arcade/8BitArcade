'use client';

import { useEffect, useRef } from 'react';
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
      }

      const existingUsername = getUsername(address);
      const existingEnsName = getEnsName(address);

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
    getEnsName,
    setIsNewUser,
    setLoading,
    setUsernameModalOpen,
    addToast,
    resetAuth,
  ]);

  return <>{children}</>;
}
