import { Timestamp } from 'firebase-admin/firestore';

export type PvpMatchStatus = 'open' | 'active' | 'completed' | 'cancelled' | 'disputed';

export interface PvpRound {
  roundIndex: number;
  gameId: string;
  creatorScore: number | null;
  challengerScore: number | null;
  creatorFinished: boolean;
  challengerFinished: boolean;
  winner: string | null; // address or null
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
}

export interface PvpMatch {
  id: string;               // e.g. "PVP-0042"
  displayNumber: number;
  creator: string;          // wallet address
  challenger: string | null;
  status: PvpMatchStatus;
  betAmount: number;        // in 8BIT (human units, not wei)
  gameIds: string[];
  numGames: number;
  rounds: PvpRound[];
  creatorTotalScore: number;
  challengerTotalScore: number;
  winner: string | null;
  createdAt: Timestamp;
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  expiresAt: Timestamp;     // 1hr after creation - auto cancel
  onChainMatchId: string | null; // bytes32 hex for paid matches
  txHashCreate: string | null;
  txHashJoin: string | null;
  txHashResolve: string | null;
}

// ─── Bracket Tournament Types ──────────────────────────────────────────────

export type BracketFormat = 'single' | 'double';
export type BracketStatus = 'registration' | 'active' | 'paused' | 'completed' | 'cancelled';
export type GameScope = 'single' | 'multi' | 'all';

// Valid bracket sizes (powers of 2 give clean brackets, others use byes)
export const VALID_BRACKET_SIZES = [4, 8, 16, 32, 64, 128] as const;
export type BracketSize = typeof VALID_BRACKET_SIZES[number];

export interface PrizeStructure {
  [place: number]: number; // place => percentage (must sum to 100)
}

export interface BracketMatch {
  matchIndex: number;    // position in round
  player1: string | null;  // address, 'BYE', or null (TBD)
  player2: string | null;
  player1Score: number | null;
  player2Score: number | null;
  player1Finished: boolean;
  player2Finished: boolean;
  winner: string | null;  // address or 'BYE'
  loser: string | null;
  status: 'pending' | 'active' | 'complete' | 'bye';
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  winnerPrize: number;    // 8BIT won
  loserPrize: number;     // 8BIT (consolation, usually 0 except 3rd place)
  isBye: boolean;
}

export interface BracketRound {
  roundIndex: number;
  name: string;  // 'Round of 64', 'Quarterfinals', 'Semifinals', 'Final', etc.
  matches: BracketMatch[];
  status: 'pending' | 'active' | 'complete';
  bracket: 'winners' | 'losers' | 'grand_final'; // for double elim
}

export interface BracketParticipant {
  address: string;
  displayName: string;
  joinedAt: Timestamp;
  seed: number;
  currentRound: number;
  isEliminated: boolean;
  eliminatedRound: number | null;
  totalEarnings: number;      // 8BIT earned in this tournament
  matchHistory: {
    roundIndex: number;
    matchIndex: number;
    opponent: string;
    opponentName: string;
    scores: number[];          // per-game scores
    opponentScores: number[];
    totalScore: number;
    opponentTotal: number;
    result: 'win' | 'loss' | 'bye';
    earnings: number;
  }[];
}

export interface BracketTournament {
  id: string;               // e.g. "BRKT-001"
  displayNumber: number;    // sequential integer shown on screen
  name: string;
  description: string;
  format: BracketFormat;
  status: BracketStatus;
  gameIds: string[];
  gameScope: GameScope;
  maxParticipants: BracketSize;
  entryFee: number;          // 8BIT
  prizePool: number;         // total 8BIT to distribute
  prizeStructure: PrizeStructure;
  burnPercentage: number;    // % of entry fees burned (default 50)
  participants: string[];    // wallet addresses
  registrationStart: Timestamp;
  registrationEnd: Timestamp;
  startTime: Timestamp | null;
  endTime: Timestamp | null;
  roundDurationMinutes: number;
  seeding: 'random' | 'rank' | 'manual';
  visibility: 'public' | 'invite' | 'hidden';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;         // admin address
  completedAt: Timestamp | null;
  winnerId: string | null;
  rounds: BracketRound[];    // embedded for easy reads
}

// ─── Chat Types ────────────────────────────────────────────────────────────

export interface ChatReactions {
  [emoji: string]: string[]; // emoji => array of addresses
}

export interface ChatMessage {
  id: string;
  author: string;            // wallet address
  displayName: string;
  avatarUrl: string | null;
  text: string;
  timestamp: Timestamp;
  replyTo: string | null;    // messageId
  replyToText: string | null;
  replyToAuthor: string | null;
  reactions: ChatReactions;
  isPinned: boolean;
  gifUrl: string | null;
  isDeleted: boolean;
  chatType: 'arena' | 'match'; // arena = global, match = per-match
  matchId: string | null;
}

// ─── Profile Types ─────────────────────────────────────────────────────────

export interface UserProfile {
  address: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  avatarFrame: number;       // 0-7, unlocked via achievements
  socialTwitter: string | null;
  socialDiscord: string | null;
  pvpWins: number;
  pvpLosses: number;
  pvpEarnings: number;       // total 8BIT earned from PvP
  tournamentWins: number;
  tournamentEarnings: number;
  privacyShowWinRate: boolean;
  privacyShowEarnings: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
