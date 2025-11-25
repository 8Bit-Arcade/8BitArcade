'use client';

import { useWalletAuth } from '@/hooks/useWalletAuth';

/**
 * Component that handles automatic Firebase authentication when wallet connects
 * Must be inside Providers to access wagmi context
 */
export default function WalletAuthProvider() {
  const { isAuthenticating, isFirebaseAuthenticated, error } = useWalletAuth();

  // This component renders nothing - it just runs the auth side effects
  // You could add a small status indicator if needed
  if (process.env.NODE_ENV === 'development' && error) {
    console.error('Wallet auth error:', error);
  }

  return null;
}
