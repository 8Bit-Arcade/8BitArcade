import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserData {
  username: string;
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
  getUsername: (address: string | null) => string | null;
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
              username,
              createdAt: Date.now(),
            },
          },
        }));
      },

      getUsername: (address) => {
        if (!address) return null;
        const normalizedAddress = address.toLowerCase();
        return get().users[normalizedAddress]?.username || null;
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
