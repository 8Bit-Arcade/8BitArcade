/**
 * Game Configuration Types and Constants
 */

export interface GameConfig {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  width: number;
  height: number;
  backgroundColor: number;
  maxScore?: number;
  controls: {
    desktop: string;
    mobile: string;
  };
}

// Shared game constants
export const GAME_COLORS = {
  BLACK: 0x0a0a0a,
  DARK: 0x1a1a2e,
  GREEN: 0x00ff41,
  CYAN: 0x00f5ff,
  PINK: 0xff00ff,
  YELLOW: 0xffff00,
  RED: 0xff0040,
  WHITE: 0xffffff,
  ORANGE: 0xff6600,
} as const;

// Standard game dimensions (4:3 aspect ratio for retro feel)
export const GAME_DIMENSIONS = {
  WIDTH: 800,
  HEIGHT: 600,
  MOBILE_WIDTH: 400,
  MOBILE_HEIGHT: 600,
} as const;

// Input types for recording
export const INPUT_TYPES = {
  MOVE: 'move',
  SHOOT: 'shoot',
  ACTION: 'action',
  PAUSE: 'pause',
  START: 'start',
} as const;

// Direction constants
export const DIRECTIONS = {
  UP: 'up',
  DOWN: 'down',
  LEFT: 'left',
  RIGHT: 'right',
  NONE: 'none',
} as const;

export type Direction = (typeof DIRECTIONS)[keyof typeof DIRECTIONS];

// Game state types
export type GameState = 'ready' | 'playing' | 'paused' | 'gameover';

// Score events
export interface ScoreEvent {
  points: number;
  reason: string;
  timestamp: number;
}

// Common game interface
export interface IGame {
  start(): void;
  pause(): void;
  resume(): void;
  destroy(): void;
  getScore(): number;
  getState(): GameState;
}

export default GameConfig;
