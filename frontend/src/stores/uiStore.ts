import { create } from 'zustand';
import type { Toast } from '@/types';

interface UIState {
  // State
  toasts: Toast[];
  isMenuOpen: boolean;
  isUsernameModalOpen: boolean;
  isWalletModalOpen: boolean;
  isDisplayPreferenceModalOpen: boolean;
  isLoading: boolean;
  loadingMessage: string | null;

  // Actions
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
  setMenuOpen: (open: boolean) => void;
  toggleMenu: () => void;
  setUsernameModalOpen: (open: boolean) => void;
  setWalletModalOpen: (open: boolean) => void;
  setDisplayPreferenceModalOpen: (open: boolean) => void;
  setLoading: (loading: boolean, message?: string) => void;
}

let toastId = 0;

export const useUIStore = create<UIState>()((set) => ({
  toasts: [],
  isMenuOpen: false,
  isUsernameModalOpen: false,
  isWalletModalOpen: false,
  isDisplayPreferenceModalOpen: false,
  isLoading: false,
  loadingMessage: null,

  addToast: (toast) => {
    const id = `toast-${++toastId}`;
    const newToast: Toast = { ...toast, id };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    // Auto-remove after duration
    const duration = toast.duration || 5000;
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, duration);
  },

  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  clearToasts: () => set({ toasts: [] }),

  setMenuOpen: (open) => set({ isMenuOpen: open }),
  toggleMenu: () => set((state) => ({ isMenuOpen: !state.isMenuOpen })),

  setUsernameModalOpen: (open) => set({ isUsernameModalOpen: open }),
  setWalletModalOpen: (open) => set({ isWalletModalOpen: open }),
  setDisplayPreferenceModalOpen: (open) => set({ isDisplayPreferenceModalOpen: open }),

  setLoading: (loading, message) =>
    set({ isLoading: loading, loadingMessage: message || null }),
}));
