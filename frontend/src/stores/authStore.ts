import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type DisplayPreference = 'ens' | 'username' | 'address';

interface UserData {
  username?: string;
  ensName?: string;
  displayPreference?: DisplayPreference;
  createdAt: number;
}

interface AuthState {
  // State
  isConnected: boolean;
  address: string | null;
  isNewUser: boolean;
  isLoading: boolean;

  // Persisted user data by wallet address
  users: Record<string, UserData>;

  // Actions
  setConnected: (connected: boolean) => void;
  setAddress: (address: string | null) => void;
  setIsNewUser: (isNew: boolean) => void;
  setLoading: (loading: boolean) => void;
  setUsername: (address: string, username: string) => void;
  setEnsName: (address: string, ensName: string | null) => void;
  setDisplayPreference: (address: string, preference: DisplayPreference) => void;
  getUsername: (address: string | null) => string | null;
  getEnsName: (address: string | null) => string | null;
  getDisplayPreference: (address: string | null) => DisplayPreference;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isConnected: false,
      address: null,
      isNewUser: false,
      isLoading: false,
      users: {},

      setConnected: (connected) => set({ isConnected: connected }),
      setAddress: (address) => set({ address }),
      setIsNewUser: (isNew) => set({ isNewUser: isNew }),
      setLoading: (loading) => set({ isLoading: loading }),

      setUsername: (address, username) => {
        const normalizedAddress = address.toLowerCase();
        set((state) => ({
          users: {
            ...state.users,
            [normalizedAddress]: {
              ...state.users[normalizedAddress],
              username,
              createdAt: state.users[normalizedAddress]?.createdAt || Date.now(),
            },
          },
        }));
      },

      setEnsName: (address, ensName) => {
        const normalizedAddress = address.toLowerCase();
        set((state) => ({
          users: {
            ...state.users,
            [normalizedAddress]: {
              ...state.users[normalizedAddress],
              ensName: ensName || undefined,
              createdAt: state.users[normalizedAddress]?.createdAt || Date.now(),
            },
          },
        }));
      },

      setDisplayPreference: (address, preference) => {
        const normalizedAddress = address.toLowerCase();
        set((state) => ({
          users: {
            ...state.users,
            [normalizedAddress]: {
              ...state.users[normalizedAddress],
              displayPreference: preference,
              createdAt: state.users[normalizedAddress]?.createdAt || Date.now(),
            },
          },
        }));
      },

      getUsername: (address) => {
        if (!address) return null;
        const normalizedAddress = address.toLowerCase();
        return get().users[normalizedAddress]?.username || null;
      },

      getEnsName: (address) => {
        if (!address) return null;
        const normalizedAddress = address.toLowerCase();
        return get().users[normalizedAddress]?.ensName || null;
      },

      getDisplayPreference: (address) => {
        if (!address) return 'address';
        const normalizedAddress = address.toLowerCase();
        const userData = get().users[normalizedAddress];

        // Default preference: ENS > Username > Address
        if (!userData?.displayPreference) {
          if (userData?.ensName) return 'ens';
          if (userData?.username) return 'username';
          return 'address';
        }

        return userData.displayPreference;
      },

      reset: () => set({
        isConnected: false,
        address: null,
        isNewUser: false,
        isLoading: false
      }),
    }),
    {
      name: '8bit-arcade-auth',
      partialize: (state) => ({
        users: state.users,
      }),
    }
  )
);

// Helper hook to get current user's username
export const useUsername = () => {
  const { address, users } = useAuthStore();
  if (!address) return null;
  return users[address.toLowerCase()]?.username || null;
};

// Helper hook to get display name based on preference
export const useDisplayName = (targetAddress?: string | null) => {
  const { address: currentAddress, users } = useAuthStore();
  const address = targetAddress || currentAddress;

  if (!address) return null;

  const normalizedAddress = address.toLowerCase();
  const userData = users[normalizedAddress];

  if (!userData) {
    // No user data - return shortened address
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  const preference = userData.displayPreference ||
    (userData.ensName ? 'ens' : userData.username ? 'username' : 'address');

  switch (preference) {
    case 'ens':
      return userData.ensName || userData.username || `${address.slice(0, 6)}...${address.slice(-4)}`;
    case 'username':
      return userData.username || userData.ensName || `${address.slice(0, 6)}...${address.slice(-4)}`;
    case 'address':
    default:
      return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
};

// Export type for use in other files
export type { DisplayPreference };
