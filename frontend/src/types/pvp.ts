// Shared PvP/Bracket/Chat/Profile types for frontend use

export type PvpMatchStatus = 'open' | 'active' | 'completed' | 'cancelled' | 'disputed';

export interface PvpRound {
  roundIndex: number;
  gameId: string;
  creatorScore: number | null;
  challengerScore: number | null;
  creatorFinished: boolean;
  challengerFinished: boolean;
  winner: string | null;
  startedAt: any;
  completedAt: any;
}

export interface PvpMatch {
  id: string;
  displayNumber: number;
  creator: string;
  challenger: string | null;
  status: PvpMatchStatus;
  betAmount: number;
  gameIds: string[];
  numGames: number;
  rounds: PvpRound[];
  creatorTotalScore: number;
  challengerTotalScore: number;
  winner: string | null;
  createdAt: any;
  startedAt: any;
  completedAt: any;
  expiresAt: any;
  onChainMatchId: string | null;
  txHashCreate: string | null;
  txHashJoin: string | null;
  txHashResolve: string | null;
}

export type BracketFormat = 'single' | 'double';
export type BracketStatus = 'registration' | 'active' | 'paused' | 'completed' | 'cancelled';
export type GameScope = 'single' | 'multi' | 'all';
export type BracketSize = 4 | 8 | 16 | 32 | 64 | 128;

export interface PrizeStructure {
  [place: number]: number;
}

export interface BracketMatchData {
  matchIndex: number;
  player1: string | null;
  player2: string | null;
  player1Score: number | null;
  player2Score: number | null;
  player1Finished: boolean;
  player2Finished: boolean;
  winner: string | null;
  loser: string | null;
  status: 'pending' | 'active' | 'complete' | 'bye';
  startedAt: any;
  completedAt: any;
  winnerPrize: number;
  loserPrize: number;
  isBye: boolean;
}

export interface BracketRoundData {
  roundIndex: number;
  name: string;
  matches: BracketMatchData[];
  status: 'pending' | 'active' | 'complete';
  bracket: 'winners' | 'losers' | 'grand_final';
}

export interface BracketTournament {
  id: string;
  displayNumber: number;
  name: string;
  description: string;
  format: BracketFormat;
  status: BracketStatus;
  gameIds: string[];
  gameScope: GameScope;
  maxParticipants: BracketSize;
  entryFee: number;
  prizePool: number;
  prizeStructure: PrizeStructure;
  burnPercentage: number;
  participants: string[];
  registrationStart: any;
  registrationEnd: any;
  startTime: any;
  endTime: any;
  roundDurationMinutes: number;
  seeding: string;
  visibility: string;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
  completedAt: any;
  winnerId: string | null;
  rounds: BracketRoundData[];
}

export interface BracketParticipant {
  address: string;
  displayName: string;
  joinedAt: any;
  seed: number;
  currentRound: number;
  isEliminated: boolean;
  eliminatedRound: number | null;
  totalEarnings: number;
  matchHistory: any[];
}

export interface ChatMessage {
  id: string;
  author: string;
  displayName: string;
  avatarUrl: string | null;
  text: string;
  timestamp: any;
  replyTo: string | null;
  replyToText: string | null;
  replyToAuthor: string | null;
  reactions: { [emoji: string]: string[] };
  isPinned: boolean;
  gifUrl: string | null;
  isDeleted: boolean;
  chatType: 'arena' | 'match';
  matchId: string | null;
}

export interface UserProfile {
  address: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  avatarFrame: number;
  socialTwitter: string | null;
  socialDiscord: string | null;
  pvpWins: number | null;
  pvpLosses: number | null;
  pvpEarnings: number | null;
  tournamentWins: number;
  tournamentEarnings: number | null;
  privacyShowWinRate: boolean;
  privacyShowEarnings: boolean;
  createdAt: any;
  memberSince: any;
  totalGamesPlayed: number;
  totalScore: number;
  isBanned: boolean;
  matchHistory: any[];
}

// Game metadata for display
export const GAME_INFO: Record<string, { name: string; emoji: string; category: string }> = {
  'space-rocks':     { name: 'Space Rocks',    emoji: '🚀', category: 'Shooter' },
  'alien-assault':   { name: 'Alien Assault',  emoji: '👾', category: 'Shooter' },
  'brick-breaker':   { name: 'Brick Breaker',  emoji: '🧱', category: 'Arcade' },
  'pixel-snake':     { name: 'Pixel Snake',    emoji: '🐍', category: 'Arcade' },
  'bug-blaster':     { name: 'Bug Blaster',    emoji: '🐛', category: 'Shooter' },
  'chomper':         { name: 'Chomper',        emoji: '👻', category: 'Arcade' },
  'flappy-bird':     { name: 'Flappy Bird',    emoji: '🐦', category: 'Arcade' },
  'galaxy-fighter':  { name: 'Galaxy Fighter', emoji: '⭐', category: 'Shooter' },
  'road-hopper':     { name: 'Road Hopper',    emoji: '🐸', category: 'Action' },
  'missile-command': { name: 'Missile Command',emoji: '💥', category: 'Shooter' },
  'block-drop':      { name: 'Block Drop',     emoji: '🟦', category: 'Puzzle' },
  'paddle-battle':   { name: 'Paddle Battle',  emoji: '🏓', category: 'Arcade' },
};

export const ALL_GAME_IDS = Object.keys(GAME_INFO);

export const BET_PRESETS = [100, 1_000, 10_000];
export const VALID_BRACKET_SIZES: BracketSize[] = [4, 8, 16, 32, 64, 128];
