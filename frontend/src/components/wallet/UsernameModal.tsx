'use client';

import { useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { isValidUsername } from '@/lib/utils';

export default function UsernameModal() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { setUsername, setIsNewUser } = useAuthStore();
  const { isUsernameModalOpen, setUsernameModalOpen, addToast } = useUIStore();

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
      // Sign message to verify ownership
      const message = `Set username to "${inputValue}" for 8-Bit Arcade\nWallet: ${address}\nTimestamp: ${Date.now()}`;

      await signMessageAsync({ message });

      // Save username linked to wallet address
      setUsername(address, inputValue);
      setIsNewUser(false);
      setUsernameModalOpen(false);
      setInputValue('');
      addToast({
        type: 'success',
        message: `Welcome, ${inputValue}!`,
      });
    } catch (err) {
      console.error('Failed to set username:', err);
      setError('Failed to verify signature. Please try again.');
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
