import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AudioState {
  // State
  musicEnabled: boolean;
  soundEnabled: boolean;
  musicVolume: number;
  soundVolume: number;
  currentTrack: string | null;

  // Actions
  toggleMusic: () => void;
  toggleSound: () => void;
  setMusicVolume: (volume: number) => void;
  setSoundVolume: (volume: number) => void;
  setCurrentTrack: (track: string | null) => void;
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set) => ({
      musicEnabled: false, // Start with music off
      soundEnabled: true,
      musicVolume: 0.5,
      soundVolume: 0.7,
      currentTrack: null,

      toggleMusic: () => set((state) => ({ musicEnabled: !state.musicEnabled })),
      toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
      setMusicVolume: (volume) => set({ musicVolume: Math.max(0, Math.min(1, volume)) }),
      setSoundVolume: (volume) => set({ soundVolume: Math.max(0, Math.min(1, volume)) }),
      setCurrentTrack: (track) => set({ currentTrack: track }),
    }),
    {
      name: '8bit-arcade-audio',
    }
  )
);
