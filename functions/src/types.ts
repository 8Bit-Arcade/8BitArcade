import { Timestamp } from 'firebase-admin/firestore';

// Game input recorded during play
export interface GameInput {
  t: number; // Timestamp in ms from game start
  type: 'direction' | 'action';
  data?: {
    up?: boolean;
    down?: boolean;
    left?: boolean;
    right?: boolean;
    action?: boolean;
  };
}

// Game session data submitted for validation
export interface GameData {
  sessionId: string;
  gameId: string;
  seed: number;
  inputs: GameInput[];
  finalScore: number;
  duration: number; // Total game duration in ms
  checksum: string;
}

// Database types
export interface UserDocument {
  address: string;
  username: string | null;
  createdAt: Timestamp;
  lastActive: Timestamp;
  totalGamesPlayed: number;
  totalScore: number;
  isBanned: boolean;
  banReason: string | null;
  flags: {
    count: number;
    reasons: string[];
    lastFlagged: Timestamp | null;
  };
}

export interface SessionDocument {
  id: string;
  player: string; // wallet address
  gameId: string;
  mode: 'free' | 'ranked' | 'tournament';
  tournamentId: string | null;
  seed: number;
  startedAt: Timestamp;
  expiresAt: Timestamp;
  completedAt: Timestamp | null;
  finalScore: number | null;
  verified: boolean;
}

export interface ScoreDocument {
  odedId: string;
  username: string;
  games: {
    [gameId: string]: {
      bestScore: number;
      totalPlays: number;
      lastPlayed: Timestamp;
    };
  };
  totalScore: number;
  totalGames: number;
}

export interface LeaderboardEntry {
  odedId: string;
  username: string;
  score: number;
  timestamp: Timestamp;
}

export interface GameLeaderboard {
  gameId: string;
  lastUpdated: Timestamp;
  daily: LeaderboardEntry[];
  weekly: LeaderboardEntry[];
  allTime: LeaderboardEntry[];
}

// Validation result
export interface ValidationResult {
  valid: boolean;
  calculatedScore: number;
  flags: string[];
  confidence: number;
}

// Tournament types
export type TournamentTier = 'standard' | 'highRoller';
export type TournamentPeriod = 'weekly' | 'monthly';
export type TournamentStatus = 'upcoming' | 'active' | 'ended' | 'finalized';

export interface TournamentDocument {
  id: string;
  tier: TournamentTier;
  period: TournamentPeriod;
  startTime: Timestamp;
  endTime: Timestamp;
  entryFee: number; // In 8BIT tokens
  prizePool: number; // In 8BIT tokens
  status: TournamentStatus;
  participants: string[]; // Array of wallet addresses
  createdAt: Timestamp;
  finalizedAt: Timestamp | null;
  winnerId: string | null;
}

export interface TournamentEntryDocument {
  tournamentId: string;
  player: string; // wallet address
  enteredAt: Timestamp;
  bestScore: number;
  lastPlayedAt: Timestamp | null;
  totalPlays: number;
  paid: boolean; // Whether entry fee was paid
  txHash: string | null; // Transaction hash of entry fee payment
}

export interface TournamentLeaderboardEntry {
  player: string;
  username: string;
  score: number;
  timestamp: Timestamp;
  rank: number;
}
