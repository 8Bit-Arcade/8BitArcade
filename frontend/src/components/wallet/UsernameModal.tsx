'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useWalletAuth } from '@/hooks/useWalletAuth';
import { isValidUsername } from '@/lib/utils';

export default function UsernameModal() {
  const { address } = useAccount();
  const { setUsername, setIsNewUser } = useAuthStore();
  const { isUsernameModalOpen, setUsernameModalOpen, addToast } = useUIStore();
  const { signInWithWallet, isFirebaseAuthenticated } = useWalletAuth();

  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!address) {
      setError('No wallet connected');
      return;
    }

    // Validate username
    if (!inputValue.trim()) {
      setError('Username is required');
      return;
    }

    if (!isValidUsername(inputValue)) {
      setError('3-20 characters, letters, numbers, and underscore only');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Authenticate with Firebase first if not already authenticated
      if (!isFirebaseAuthenticated) {
        console.log('Authenticating with Firebase before saving username...');
        const success = await signInWithWallet();
        if (!success) {
          setError('Failed to authenticate. Please try again.');
          setIsLoading(false);
          return;
        }
      }

      // Save username to Firestore
      const { getFirestoreInstance, isFirebaseConfigured } = await import('@/lib/firebase-client');
      if (isFirebaseConfigured()) {
        const [db, { doc, setDoc, serverTimestamp }] = await Promise.all([
          getFirestoreInstance(),
          import('firebase/firestore'),
        ]);

        const userRef = doc(db, 'users', address.toLowerCase());
        await setDoc(userRef, {
          username: inputValue,
          address: address.toLowerCase(),
          createdAt: serverTimestamp(),
          lastActive: serverTimestamp(),
        }, { merge: true });

        console.log('✅ Username saved to Firestore:', inputValue);
      }

      // Save username linked to wallet address (localStorage)
      setUsername(address, inputValue);
      setIsNewUser(false);
      setUsernameModalOpen(false);
      setInputValue('');
      addToast({
        type: 'success',
        message: `Welcome, ${inputValue}!`,
      });
    } catch (err: any) {
      console.error('Failed to set username:', err);

      // Provide more specific error messages
      if (err.message?.includes('User rejected') || err.message?.includes('User denied')) {
        setError('Signature rejected. Please sign the message to set your username.');
      } else if (err.message?.includes('permissions')) {
        setError('Permission denied. Please try reconnecting your wallet.');
      } else {
        setError('Failed to save username. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    setIsNewUser(false);
    setUsernameModalOpen(false);
    setInputValue('');
    addToast({
      type: 'info',
      message: 'You can set a username later in your profile',
    });
  };

  return (
    <Modal
      isOpen={isUsernameModalOpen}
      onClose={handleSkip}
      title="Create Username"
      closeOnOverlayClick={false}
    >
      <div className="space-y-4">
        <p className="font-arcade text-gray-300">
          Choose a display name for the leaderboards. This will be visible to
          other players.
        </p>

        <Input
          label="Username"
          placeholder="Enter username..."
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setError('');
          }}
          error={error}
          helperText="3-20 characters, letters, numbers, and underscore"
          maxLength={20}
          autoFocus
        />

        <div className="flex gap-3 pt-2">
          <Button variant="ghost" onClick={handleSkip} className="flex-1">
            Skip
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isLoading}
            className="flex-1"
          >
            Confirm
          </Button>
        </div>

        <p className="font-arcade text-xs text-gray-500 text-center">
          You&apos;ll sign a message to verify wallet ownership
        </p>
      </div>
    </Modal>
  );
}
