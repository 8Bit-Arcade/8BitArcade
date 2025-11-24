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
    maxTheoreticalScore: 999999,
    minGameDuration: 5000, // At least 5 seconds
    maxInputsPerSecond: 30,
    pointsPerSecondLimit: 500, // ~500 points per second max
  },
  'alien-assault': {
    id: 'alien-assault',
    name: 'Alien Assault',
    maxTheoreticalScore: 999999,
    minGameDuration: 10000,
    maxInputsPerSecond: 25,
    pointsPerSecondLimit: 300,
  },
  'brick-breaker': {
    id: 'brick-breaker',
    name: 'Brick Breaker',
    maxTheoreticalScore: 999999,
    minGameDuration: 10000,
    maxInputsPerSecond: 20,
    pointsPerSecondLimit: 200,
  },
  'pixel-snake': {
    id: 'pixel-snake',
    name: 'Pixel Snake',
    maxTheoreticalScore: 999999,
    minGameDuration: 5000,
    maxInputsPerSecond: 15,
    pointsPerSecondLimit: 50,
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
