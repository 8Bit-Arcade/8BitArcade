'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { useAuthStore, type DisplayPreference } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useWalletAuth } from '@/hooks/useWalletAuth';

export default function DisplayPreferenceModal() {
  const { address } = useAccount();
  const {
    users,
    setDisplayPreference,
    getDisplayPreference,
  } = useAuthStore();
  const { isDisplayPreferenceModalOpen, setDisplayPreferenceModalOpen, addToast } = useUIStore();
  const { signInWithWallet, isFirebaseAuthenticated } = useWalletAuth();

  const userData = address ? users[address.toLowerCase()] : null;
  const currentPreference = address ? getDisplayPreference(address) : 'address';

  const [selectedPreference, setSelectedPreference] = useState<DisplayPreference>(currentPreference);

  const options: { value: DisplayPreference; label: string; description: string; example: string }[] = [
    {
      value: 'ens',
      label: 'ENS Domain',
      description: 'Your Ethereum Name Service domain',
      example: userData?.ensName || 'Not available',
    },
    {
      value: 'username',
      label: 'Username',
      description: 'Your custom arcade username',
      example: userData?.username || 'Not set',
    },
    {
      value: 'address',
      label: 'Wallet Address',
      description: 'Shortened wallet address',
      example: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '0x0000...0000',
    },
  ];

  const handleSave = async () => {
    if (!address) return;

    setDisplayPreference(address, selectedPreference);

    // Save to Firestore
    try {
      // Authenticate with Firebase first if not already authenticated
      if (!isFirebaseAuthenticated) {
        console.log('Authenticating with Firebase before saving display preference...');
        const success = await signInWithWallet();
        if (!success) {
          addToast({
            type: 'error',
            message: 'Failed to authenticate. Preference saved locally only.',
          });
          setDisplayPreferenceModalOpen(false);
          return;
        }
      }

      const { getFirestoreInstance, isFirebaseConfigured } = await import('@/lib/firebase-client');
      if (isFirebaseConfigured()) {
        const [db, { doc, setDoc }] = await Promise.all([
          getFirestoreInstance(),
          import('firebase/firestore'),
        ]);

        const userRef = doc(db, 'users', address.toLowerCase());
        await setDoc(userRef, {
          displayPreference: selectedPreference,
        }, { merge: true });

        console.log('✅ Display preference saved to Firestore');
      }
    } catch (err) {
      console.warn('Could not save display preference to Firestore:', err);
      addToast({
        type: 'warning',
        message: 'Display preference saved locally only',
      });
    }

    setDisplayPreferenceModalOpen(false);
    addToast({
      type: 'success',
      message: 'Display preference updated!',
    });
  };

  return (
    <Modal
      isOpen={isDisplayPreferenceModalOpen}
      onClose={() => setDisplayPreferenceModalOpen(false)}
      title="Display Preference"
    >
      <div className="space-y-4">
        <p className="font-arcade text-gray-300 text-sm">
          Choose how you want to appear on leaderboards and throughout the arcade.
        </p>

        <div className="space-y-2">
          {options.map((option) => {
            const isDisabled =
              (option.value === 'ens' && !userData?.ensName) ||
              (option.value === 'username' && !userData?.username);

            return (
              <button
                key={option.value}
                type="button"
                disabled={isDisabled}
                onClick={() => !isDisabled && setSelectedPreference(option.value)}
                className={`
                  w-full p-4 rounded border-2 text-left transition-all
                  ${selectedPreference === option.value
                    ? 'border-arcade-green bg-arcade-green/10'
                    : 'border-arcade-dark/50 hover:border-arcade-green/50'
                  }
                  ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-pixel text-arcade-green text-sm">
                        {option.label}
                      </span>
                      {selectedPreference === option.value && (
                        <span className="font-pixel text-xs text-arcade-yellow">
                          ✓ SELECTED
                        </span>
                      )}
                    </div>
                    <p className="font-arcade text-xs text-gray-400 mb-2">
                      {option.description}
                    </p>
                    <p className={`
                      font-arcade text-sm
                      ${isDisabled ? 'text-gray-600' : 'text-white'}
                    `}>
                      {option.example}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="ghost"
            onClick={() => setDisplayPreferenceModalOpen(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            className="flex-1"
          >
            Save
          </Button>
        </div>

        <p className="font-arcade text-xs text-gray-500 text-center">
          Your choice will be reflected across all leaderboards
        </p>
      </div>
    </Modal>
  );
}
