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
export { unbanAccount, clearUserFlags, getFlaggedUsers, getUserBanInfo, seedTournamentEntries } from './admin/adminFunctions';

// Sale Admin Functions
export {
    trackPurchase,
    getAllPurchases,
    getAllBuyers,
    getSaleStats,
    updateSaleConfig,
    getSaleConfig
} from './sale/saleAdminFunctions';

// ETH Price (off-chain) - writes to system/prices for sale page
export { getEthPrice, scheduledPriceUpdate } from './sale/getEthPrice';

// Tournament functions
export { createWeeklyTournaments, createMonthlyTournaments, createTournamentManual, ensureActiveTournaments } from './tournaments/scheduleTournaments';
export { getTournaments } from './tournaments/getTournaments';
export { getTournamentLeaderboard } from './tournaments/getTournamentLeaderboard';
export { enterTournament } from './tournaments/enterTournament';
export { createTournament } from './tournaments/createTournament';
export { finalizeTournament } from './tournaments/finalizeTournament';
export { initializeTournamentIfMissing } from './tournaments/initializeTournamentIfMissing';
export { syncTournamentEntry } from './tournaments/syncTournamentEntry';
export { getPlayerActiveTournaments } from './tournaments/getPlayerActiveTournaments';
export { getTournamentParticipants } from './tournaments/getTournamentParticipants';
export { updateTournamentStatuses, updateTournamentStatusesManual } from './tournaments/updateTournamentStatus';
export { syncOnChainTournaments } from './tournaments/syncOnChainTournaments';
export { fixTournamentData } from './tournaments/fixTournamentData';
export { diagnoseTournaments, forceSyncPlayerEntries } from './tournaments/diagnoseTournaments';

// Airdrop functions
export {
    triggerAirdropSnapshot,
    getAirdropStatus,
    getAirdropLeaderboard,
    markAirdropClaimed,
    setAirdropContract,
    getAdminAirdropAllocations
} from './airdrop/calculateAirdrop';

// Airdrop Admin functions
export {
    getAirdropConfig_fn as getAirdropConfig,
    updateAirdropConfig,
    startAirdrop,
    pauseAirdrop,
    resumeAirdrop,
    stopAirdrop,
    extendAirdrop,
    editUserWallet,
    overrideUserAllocation,
    getAllocationOverrides,
    removeAllocationOverride,
    getWalletChangeHistory,
    testAirdropDistribution,
    getAirdropDashboardStats,
    // Future-proofing functions
    blacklistWallet,
    removeFromBlacklist,
    getBlacklist,
    whitelistWallet,
    removeFromWhitelist,
    getWhitelist,
    bulkOverrideAllocations,
    exportAllocations,
    recalculateUserAllocation,
    getClaimStatus,
    createSnapshotBackup,
    restoreFromBackup,
    getBackups,
    getTierConfig,
    updateTierConfig,
    getAuditLog,
    emergencyPause,
    liftEmergencyPause,
    getSystemVersion,
    runMigration
} from './airdrop/airdropAdmin';

// Zealy integration
export { zealyVerifyQuest } from './zealy/verifyQuest';
export { syncZealyUsers, scheduledZealySync, zealyWebhook, linkZealyWallet } from './zealy/syncZealyUsers';

// Rewards distribution
export { distributeDailyRewards, manualDistributeRewards, testCheckLeaderboard } from './rewards/distributeRewards';

// Re-export types for use in frontend
export type { GameInput, GameData, ValidationResult } from './types';
