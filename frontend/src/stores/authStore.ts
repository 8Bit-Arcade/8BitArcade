import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  // State
  isConnected: boolean;
  address: string | null;
  username: string | null;
  isNewUser: boolean;
  isLoading: boolean;

  // Actions
  setConnected: (connected: boolean) => void;
  setAddress: (address: string | null) => void;
  setUsername: (username: string | null) => void;
  setIsNewUser: (isNew: boolean) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

const initialState = {
  isConnected: false,
  address: null,
  username: null,
  isNewUser: false,
  isLoading: false,
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...initialState,

      setConnected: (connected) => set({ isConnected: connected }),
      setAddress: (address) => set({ address }),
      setUsername: (username) => set({ username }),
      setIsNewUser: (isNew) => set({ isNewUser: isNew }),
      setLoading: (loading) => set({ isLoading: loading }),
      reset: () => set(initialState),
    }),
    {
      name: '8bit-arcade-auth',
      partialize: (state) => ({
        username: state.username,
      }),
    }
  )
);
