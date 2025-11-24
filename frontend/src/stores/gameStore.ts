import { create } from 'zustand';
import type { GameMode, GameInput } from '@/types';

interface GameState {
  // State
  currentGame: string | null;
  gameMode: GameMode;
  sessionId: string | null;
  seed: number | null;
  score: number;
  highScore: number;
  isPlaying: boolean;
  isPaused: boolean;
  isGameOver: boolean;
  inputs: GameInput[];
  startTime: number | null;

  // Actions
  startGame: (gameId: string, mode: GameMode, sessionId?: string, seed?: number) => void;
  endGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  setScore: (score: number) => void;
  addScore: (points: number) => void;
  recordInput: (input: Omit<GameInput, 't'>) => void;
  setGameOver: (isOver: boolean) => void;
  reset: () => void;
}

const initialState = {
  currentGame: null,
  gameMode: 'free' as GameMode,
  sessionId: null,
  seed: null,
  score: 0,
  highScore: 0,
  isPlaying: false,
  isPaused: false,
  isGameOver: false,
  inputs: [],
  startTime: null,
};

export const useGameStore = create<GameState>()((set, get) => ({
  ...initialState,

  startGame: (gameId, mode, sessionId, seed) => {
    set({
      currentGame: gameId,
      gameMode: mode,
      sessionId: sessionId || null,
      seed: seed || Math.floor(Math.random() * 2147483647),
      score: 0,
      isPlaying: true,
      isPaused: false,
      isGameOver: false,
      inputs: [],
      startTime: Date.now(),
    });
  },

  endGame: () => {
    const { score, highScore } = get();
    set({
      isPlaying: false,
      isGameOver: true,
      highScore: Math.max(score, highScore),
    });
  },

  pauseGame: () => set({ isPaused: true }),
  resumeGame: () => set({ isPaused: false }),

  setScore: (score) => set({ score }),
  addScore: (points) => set((state) => ({ score: state.score + points })),

  recordInput: (input) => {
    const { startTime } = get();
    if (startTime === null) return;

    const timestamp = Date.now() - startTime;
    set((state) => ({
      inputs: [...state.inputs, { t: timestamp, ...input }],
    }));
  },

  setGameOver: (isOver) => set({ isGameOver: isOver }),

  reset: () => set(initialState),
}));
