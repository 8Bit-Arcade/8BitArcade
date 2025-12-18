/**
 * 8-Bit Arcade Firebase Cloud Functions
 *
 * Exports all Cloud Functions for the 8-Bit Arcade platform
 */

// Auth functions
export { createSession } from './auth/createSession';
export { verifyWallet } from './auth/verifyWallet';

// Score functions
export { submitScore } from './scores/submitScore';

// Leaderboard functions
export { getLeaderboard } from './leaderboard/getLeaderboard';
export { resetDailyLeaderboards, resetWeeklyLeaderboards } from './leaderboard/resetDailyLeaderboards';

// Admin functions
export { unbanAccount, clearUserFlags, getFlaggedUsers, getUserBanInfo } from './admin/adminFunctions';

// Tournament functions
export { createWeeklyTournaments, createMonthlyTournaments, createTournamentManual } from './tournaments/scheduleTournaments';

// Re-export types for use in frontend
export type { GameInput, GameData, ValidationResult } from './types';
