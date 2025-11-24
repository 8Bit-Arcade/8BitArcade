// User types
export interface User {
  address: string;
  username: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  lastActive: Date;
  totalGamesPlayed: number;
  totalScore: number;
  favoriteGame: string | null;
  isBanned: boolean;
}

// Game types
export interface Game {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  maxTheoreticalScore: number;
  difficulty: 'easy' | 'medium' | 'hard';
  controls: {
    mobile: string;
    desktop: string;
  };
  isActive: boolean;
}

export type GameMode = 'free' | 'ranked' | 'tournament';

export interface GameSession {
  id: string;
  player: string;
  gameId: string;
  mode: GameMode;
  tournamentId: string | null;
  seed: number;
  startedAt: Date;
  expiresAt: Date;
}

export interface GameInput {
  t: number;      // Timestamp (ms from game start)
  type: string;   // Input type: 'move', 'shoot', 'action', etc.
  data?: Record<string, unknown>;
}

export interface GameData {
  sessionId: string;
  gameId: string;
  seed: number;
  inputs: GameInput[];
  finalScore: number;
  checksum: string;
}

// Leaderboard types
export interface LeaderboardEntry {
  odedId: string;
  username: string;
  score: number;
  timestamp: Date;
  rank?: number;
}

export interface Leaderboard {
  gameId: string;
  period: 'daily' | 'weekly' | 'allTime';
  entries: LeaderboardEntry[];
  lastUpdated: Date;
}

// Tournament types
export interface Tournament {
  id: string;
  name: string;
  description: string;
  games: string[];
  entryFee: number;
  prizePool: number;
  startTime: Date;
  endTime: Date;
  status: 'upcoming' | 'active' | 'ended' | 'finalized';
  maxParticipants: number | null;
  participantCount: number;
}

export interface TournamentParticipant {
  odedId: string;
  username: string;
  scores: Record<string, number>;
  totalScore: number;
  timePlayed: number;
  gamesCompleted: number;
}

// Rewards types
export interface Reward {
  amount: number;
  reason: 'daily_rank' | 'tournament' | 'bonus';
  gameId: string | null;
  rank: number | null;
  timestamp: Date;
  claimed: boolean;
  txHash: string | null;
}

export interface RewardStatus {
  pending: number;
  claimed: number;
  history: Reward[];
}

// Audio types
export interface AudioSettings {
  musicEnabled: boolean;
  soundEnabled: boolean;
  musicVolume: number;
  soundVolume: number;
}

// UI types
export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}
