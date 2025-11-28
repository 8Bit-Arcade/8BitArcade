// Game configurations for server-side validation
export interface GameConfig {
  id: string;
  name: string;
  maxTheoreticalScore: number;
  minGameDuration: number; // ms
  maxInputsPerSecond: number;
  pointsPerSecondLimit: number; // Max reasonable points/second
}

export const GAME_CONFIGS: Record<string, GameConfig> = {
  'space-rocks': {
    id: 'space-rocks',
    name: 'Space Rocks',
    maxTheoreticalScore: 75000, // ~30 waves max in perfect play
    minGameDuration: 5000, // At least 5 seconds
    maxInputsPerSecond: 30,
    pointsPerSecondLimit: 500, // ~500 points per second max
  },
  'alien-assault': {
    id: 'alien-assault',
    name: 'Alien Assault',
    maxTheoreticalScore: 50000, // ~250 aliens max per game
    minGameDuration: 10000,
    maxInputsPerSecond: 25,
    pointsPerSecondLimit: 300,
  },
  'brick-breaker': {
    id: 'brick-breaker',
    name: 'Brick Breaker',
    maxTheoreticalScore: 30000, // All bricks + combos
    minGameDuration: 10000,
    maxInputsPerSecond: 20,
    pointsPerSecondLimit: 200,
  },
  'pixel-snake': {
    id: 'pixel-snake',
    name: 'Pixel Snake',
    maxTheoreticalScore: 100000, // Theoretical max length
    minGameDuration: 5000,
    maxInputsPerSecond: 15,
    pointsPerSecondLimit: 50,
  },
  'paddle-battle': {
    id: 'paddle-battle',
    name: 'Paddle Battle',
    maxTheoreticalScore: 1100, // 11 points to win * 100
    minGameDuration: 10000,
    maxInputsPerSecond: 20,
    pointsPerSecondLimit: 50,
  },
  'road-hopper': {
    id: 'road-hopper',
    name: 'Road Hopper',
    maxTheoreticalScore: 50000, // Multiple levels
    minGameDuration: 5000,
    maxInputsPerSecond: 10,
    pointsPerSecondLimit: 200,
  },
  'block-drop': {
    id: 'block-drop',
    name: 'Block Drop',
    maxTheoreticalScore: 100000, // Many levels possible
    minGameDuration: 10000,
    maxInputsPerSecond: 15,
    pointsPerSecondLimit: 300,
  },
  'chomper': {
    id: 'chomper',
    name: 'Chomper',
    maxTheoreticalScore: 50000, // Multiple levels
    minGameDuration: 10000,
    maxInputsPerSecond: 10,
    pointsPerSecondLimit: 100,
  },
  'galaxy-fighter': {
    id: 'galaxy-fighter',
    name: 'Galaxy Fighter',
    maxTheoreticalScore: 100000, // Many waves
    minGameDuration: 5000,
    maxInputsPerSecond: 30,
    pointsPerSecondLimit: 500,
  },
  'tunnel-terror': {
    id: 'tunnel-terror',
    name: 'Tunnel Terror',
    maxTheoreticalScore: 75000, // Multiple levels
    minGameDuration: 10000,
    maxInputsPerSecond: 15,
    pointsPerSecondLimit: 300,
  },
  'barrel-dodge': {
    id: 'barrel-dodge',
    name: 'Barrel Dodge',
    maxTheoreticalScore: 50000, // Multiple levels
    minGameDuration: 10000,
    maxInputsPerSecond: 20,
    pointsPerSecondLimit: 200,
  },
  'bug-blaster': {
    id: 'bug-blaster',
    name: 'Bug Blaster',
    maxTheoreticalScore: 100000, // Many levels
    minGameDuration: 10000,
    maxInputsPerSecond: 30,
    pointsPerSecondLimit: 500,
  },
};

// Daily reward tiers
export const DAILY_REWARDS = [
  { rank: 1, amount: 1000 },
  { rank: 2, amount: 500 },
  { rank: 3, amount: 500 },
  { rank: 4, amount: 500 },
  { rank: 5, amount: 500 },
  { rank: 6, amount: 250 },
  { rank: 7, amount: 250 },
  { rank: 8, amount: 250 },
  { rank: 9, amount: 250 },
  { rank: 10, amount: 250 },
  // 11-50: 100 each
  // 51-100: 50 each
];

export function getRewardForRank(rank: number): number {
  if (rank <= 0) return 0;
  if (rank <= 10) return DAILY_REWARDS[rank - 1]?.amount || 0;
  if (rank <= 50) return 100;
  if (rank <= 100) return 50;
  return 0;
}
