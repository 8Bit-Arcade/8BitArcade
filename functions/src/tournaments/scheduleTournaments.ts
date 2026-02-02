/**
 * Automated Tournament Creation
 *
 * This Cloud Function runs on a schedule to automatically create:
 * - Weekly tournaments (every Monday at 00:00 UTC)
 * - Monthly tournaments (every 1st of the month at 00:00 UTC)
 *
 * Both Standard and High Roller tiers are created for each period.
 * Tournaments are created both on-chain AND in Firebase for score syncing.
 *
 * SETUP: Before these functions work, you must set secrets in Google Cloud:
 *
 * firebase functions:secrets:set DEPLOYER_PRIVATE_KEY
 * firebase functions:secrets:set TOURNAMENT_MANAGER_ADDRESS
 *
 * Then redeploy: firebase deploy --only functions
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { ethers } from 'ethers';
import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { TournamentDocument, TournamentTier, TournamentPeriod } from '../types';

// Define secrets (these are set via Firebase CLI)
const deployerPrivateKey = defineSecret('DEPLOYER_PRIVATE_KEY');
const tournamentManagerAddress = defineSecret('TOURNAMENT_MANAGER_ADDRESS');

// Contract ABI (only the functions we need)
const TOURNAMENT_MANAGER_ABI = [
  'function createTournament(uint8 tier, uint8 period, uint256 startTime, uint256 endTime) external returns (uint256)',
  'function nextTournamentId() view returns (uint256)',
];

// Tournament enums (must match Solidity contract)
enum Tier {
  STANDARD = 0,
  HIGH_ROLLER = 1,
}

enum Period {
  WEEKLY = 0,
  MONTHLY = 1,
}

// Entry fees and prize pools by tier (in 8BIT tokens)
const TOURNAMENT_CONFIG = {
  weekly: {
    standard: { entryFee: 2000, prizePool: 50000 },
    highRoller: { entryFee: 10000, prizePool: 150000 },
  },
  monthly: {
    standard: { entryFee: 10000, prizePool: 100000 },
    highRoller: { entryFee: 50000, prizePool: 500000 },
  },
};

// Network configuration
const ARBITRUM_SEPOLIA_RPC = 'https://sepolia-rollup.arbitrum.io/rpc';
const ARBITRUM_ONE_RPC = 'https://arb1.arbitrum.io/rpc';

/**
 * Create Firebase document for a tournament
 */
async function createFirebaseTournament(
  tournamentId: string,
  tier: TournamentTier,
  period: TournamentPeriod,
  startTimeUnix: number,
  endTimeUnix: number,
  entryFee: number,
  prizePool: number,
  txHash: string,
  isOffChain: boolean = false
): Promise<void> {
  const now = Timestamp.now();
  const startTime = Timestamp.fromMillis(startTimeUnix * 1000);
  const endTime = Timestamp.fromMillis(endTimeUnix * 1000);

  // Determine status based on start time
  const status = startTime.toMillis() > now.toMillis() ? 'upcoming' : 'active';

  const tournament: TournamentDocument = {
    id: tournamentId,
    tier,
    period,
    startTime,
    endTime,
    entryFee,
    prizePool,
    status,
    participants: [],
    createdAt: now,
    finalizedAt: null,
    winnerId: null,
    txHash, // Store the blockchain transaction hash (empty if off-chain only)
    isOffChain, // Flag to indicate Firebase-only tournament (no on-chain record)
  };

  await db.collection('tournaments').doc(tournamentId).set(tournament);
  logger.info(`Firebase tournament document created: ${tournamentId} (status: ${status}, offChain: ${isOffChain})`);
}

/**
 * Generate a unique tournament ID for Firebase-only tournaments
 * Uses timestamp + random suffix to avoid collisions
 */
function generateOffChainTournamentId(tier: TournamentTier, period: TournamentPeriod): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `offchain_${tier}_${period}_${timestamp}_${random}`;
}

/**
 * Create Firebase-only tournament as fallback when on-chain creation fails
 * This allows tournaments to run and track scores while waiting for contract fixes
 */
async function createFirebaseOnlyTournament(
  tier: TournamentTier,
  period: TournamentPeriod,
  startTimeUnix: number,
  endTimeUnix: number
): Promise<{ id: string; success: boolean }> {
  const config = TOURNAMENT_CONFIG[period][tier === 'standard' ? 'standard' : 'highRoller'];
  const tournamentId = generateOffChainTournamentId(tier, period);

  await createFirebaseTournament(
    tournamentId,
    tier,
    period,
    startTimeUnix,
    endTimeUnix,
    config.entryFee,
    config.prizePool,
    '', // No tx hash for off-chain tournaments
    true // Mark as off-chain
  );

  logger.warn(`⚠️ Created Firebase-only tournament ${tournamentId} (off-chain fallback)`);
  return { id: tournamentId, success: true };
}

/**
 * Create Weekly Tournaments
 * Runs every Monday at 00:00 UTC
 */
export const createWeeklyTournaments = onSchedule(
  {
    schedule: '0 0 * * 1', // Every Monday at midnight UTC
    timeZone: 'UTC',
    region: 'us-central1',
    secrets: [deployerPrivateKey, tournamentManagerAddress], // Inject secrets
  },
  async (event) => {
    logger.info('Creating weekly tournaments...', { time: event.scheduleTime });

    try {
      // Get secrets
      const managerAddress = tournamentManagerAddress.value();
      const privateKey = deployerPrivateKey.value();
      const network = process.env.NETWORK || 'testnet';

      if (!managerAddress || !privateKey) {
        throw new Error('Missing secrets: TOURNAMENT_MANAGER_ADDRESS or DEPLOYER_PRIVATE_KEY. Run: firebase functions:secrets:set <SECRET_NAME>');
      }

      // Connect to network
      const rpcUrl = network === 'mainnet' ? ARBITRUM_ONE_RPC : ARBITRUM_SEPOLIA_RPC;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      const tournamentManager = new ethers.Contract(
        managerAddress,
        TOURNAMENT_MANAGER_ABI,
        wallet
      );

      // Calculate tournament period (next 7 days)
      const now = Math.floor(Date.now() / 1000);
      const startTime = now + 3600; // Start in 1 hour
      const endTime = startTime + (7 * 24 * 60 * 60); // 7 days duration

      // Create Standard Weekly Tournament - try on-chain first, fallback to Firebase-only
      try {
        const nextId1 = await tournamentManager.nextTournamentId();
        logger.info('Creating Standard Weekly tournament...');
        const tx1 = await tournamentManager.createTournament(
          Tier.STANDARD,
          Period.WEEKLY,
          startTime,
          endTime
        );
        const receipt1 = await tx1.wait();
        logger.info('Standard Weekly tournament created on-chain', { txHash: receipt1?.hash });

        // Create Firebase document for Standard Weekly
        const standardConfig = TOURNAMENT_CONFIG.weekly.standard;
        await createFirebaseTournament(
          nextId1.toString(),
          'standard',
          'weekly',
          startTime,
          endTime,
          standardConfig.entryFee,
          standardConfig.prizePool,
          receipt1?.hash || ''
        );
      } catch (onChainError) {
        logger.warn('On-chain Standard Weekly creation failed, using Firebase-only fallback:', onChainError);
        await createFirebaseOnlyTournament('standard', 'weekly', startTime, endTime);
      }

      // Create High Roller Weekly Tournament - try on-chain first, fallback to Firebase-only
      try {
        const nextId2 = await tournamentManager.nextTournamentId();
        logger.info('Creating High Roller Weekly tournament...');
        const tx2 = await tournamentManager.createTournament(
          Tier.HIGH_ROLLER,
          Period.WEEKLY,
          startTime,
          endTime
        );
        const receipt2 = await tx2.wait();
        logger.info('High Roller Weekly tournament created on-chain', { txHash: receipt2?.hash });

        // Create Firebase document for High Roller Weekly
        const highRollerConfig = TOURNAMENT_CONFIG.weekly.highRoller;
        await createFirebaseTournament(
          nextId2.toString(),
          'highRoller',
          'weekly',
          startTime,
          endTime,
          highRollerConfig.entryFee,
          highRollerConfig.prizePool,
          receipt2?.hash || ''
        );
      } catch (onChainError) {
        logger.warn('On-chain High Roller Weekly creation failed, using Firebase-only fallback:', onChainError);
        await createFirebaseOnlyTournament('highRoller', 'weekly', startTime, endTime);
      }

      logger.info('Weekly tournaments created successfully!');

    } catch (error) {
      logger.error('Error creating weekly tournaments:', error);
      throw error;
    }
  }
);

/**
 * Create Monthly Tournaments
 * Runs on the 1st of every month at 00:00 UTC
 */
export const createMonthlyTournaments = onSchedule(
  {
    schedule: '0 0 1 * *', // 1st day of every month at midnight UTC
    timeZone: 'UTC',
    region: 'us-central1',
    secrets: [deployerPrivateKey, tournamentManagerAddress], // Inject secrets
  },
  async (event) => {
    logger.info('Creating monthly tournaments...', { time: event.scheduleTime });

    try {
      // Get secrets
      const managerAddress = tournamentManagerAddress.value();
      const privateKey = deployerPrivateKey.value();
      const network = process.env.NETWORK || 'testnet';

      if (!managerAddress || !privateKey) {
        throw new Error('Missing secrets: TOURNAMENT_MANAGER_ADDRESS or DEPLOYER_PRIVATE_KEY. Run: firebase functions:secrets:set <SECRET_NAME>');
      }

      // Connect to network
      const rpcUrl = network === 'mainnet' ? ARBITRUM_ONE_RPC : ARBITRUM_SEPOLIA_RPC;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      const tournamentManager = new ethers.Contract(
        managerAddress,
        TOURNAMENT_MANAGER_ABI,
        wallet
      );

      // Calculate tournament period (next 30 days)
      const now = Math.floor(Date.now() / 1000);
      const startTime = now + 3600; // Start in 1 hour
      const endTime = startTime + (30 * 24 * 60 * 60); // 30 days duration

      // Create Standard Monthly Tournament - try on-chain first, fallback to Firebase-only
      try {
        const nextId1 = await tournamentManager.nextTournamentId();
        logger.info('Creating Standard Monthly tournament...');
        const tx1 = await tournamentManager.createTournament(
          Tier.STANDARD,
          Period.MONTHLY,
          startTime,
          endTime
        );
        const receipt1 = await tx1.wait();
        logger.info('Standard Monthly tournament created on-chain', { txHash: receipt1?.hash });

        // Create Firebase document for Standard Monthly
        const standardConfig = TOURNAMENT_CONFIG.monthly.standard;
        await createFirebaseTournament(
          nextId1.toString(),
          'standard',
          'monthly',
          startTime,
          endTime,
          standardConfig.entryFee,
          standardConfig.prizePool,
          receipt1?.hash || ''
        );
      } catch (onChainError) {
        logger.warn('On-chain Standard Monthly creation failed, using Firebase-only fallback:', onChainError);
        await createFirebaseOnlyTournament('standard', 'monthly', startTime, endTime);
      }

      // Create High Roller Monthly Tournament - try on-chain first, fallback to Firebase-only
      try {
        const nextId2 = await tournamentManager.nextTournamentId();
        logger.info('Creating High Roller Monthly tournament...');
        const tx2 = await tournamentManager.createTournament(
          Tier.HIGH_ROLLER,
          Period.MONTHLY,
          startTime,
          endTime
        );
        const receipt2 = await tx2.wait();
        logger.info('High Roller Monthly tournament created on-chain', { txHash: receipt2?.hash });

        // Create Firebase document for High Roller Monthly
        const highRollerConfig = TOURNAMENT_CONFIG.monthly.highRoller;
        await createFirebaseTournament(
          nextId2.toString(),
          'highRoller',
          'monthly',
          startTime,
          endTime,
          highRollerConfig.entryFee,
          highRollerConfig.prizePool,
          receipt2?.hash || ''
        );
      } catch (onChainError) {
        logger.warn('On-chain High Roller Monthly creation failed, using Firebase-only fallback:', onChainError);
        await createFirebaseOnlyTournament('highRoller', 'monthly', startTime, endTime);
      }

      logger.info('Monthly tournaments created successfully!');

    } catch (error) {
      logger.error('Error creating monthly tournaments:', error);
      throw error;
    }
  }
);

/**
 * Manual tournament creation callable function
 * Can be triggered via Firebase console, CLI, or frontend admin panel
 *
 * Usage: Call with { period: 'weekly' | 'monthly' }
 * This will create BOTH Standard and High Roller tournaments for that period
 */
export const createTournamentManual = onCall(
  {
    cors: true,
    secrets: [deployerPrivateKey, tournamentManagerAddress],
  },
  async (request) => {
    const { period } = request.data as { period?: 'weekly' | 'monthly' };

    if (!period || !['weekly', 'monthly'].includes(period)) {
      throw new HttpsError('invalid-argument', 'Period must be "weekly" or "monthly"');
    }

    logger.info(`Manual ${period} tournament creation triggered`);

    try {
      // Get secrets
      const managerAddress = tournamentManagerAddress.value();
      const privateKey = deployerPrivateKey.value();
      const network = process.env.NETWORK || 'testnet';

      if (!managerAddress || !privateKey) {
        throw new HttpsError(
          'failed-precondition',
          'Missing secrets: TOURNAMENT_MANAGER_ADDRESS or DEPLOYER_PRIVATE_KEY. Run: firebase functions:secrets:set <SECRET_NAME>'
        );
      }

      // Connect to network
      const rpcUrl = network === 'mainnet' ? ARBITRUM_ONE_RPC : ARBITRUM_SEPOLIA_RPC;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      const tournamentManager = new ethers.Contract(
        managerAddress,
        TOURNAMENT_MANAGER_ABI,
        wallet
      );

      // Calculate tournament period
      const now = Math.floor(Date.now() / 1000);
      const startTime = now + 3600; // Start in 1 hour
      const durationDays = period === 'weekly' ? 7 : 30;
      const endTime = startTime + (durationDays * 24 * 60 * 60);

      const results: { standard?: { id: string; txHash: string; isOffChain?: boolean }; highRoller?: { id: string; txHash: string; isOffChain?: boolean } } = {};

      // Create Standard Tournament - try on-chain first, fallback to Firebase-only
      try {
        const nextId1 = await tournamentManager.nextTournamentId();
        logger.info(`Creating Standard ${period} tournament (ID: ${nextId1})...`);

        const tx1 = await tournamentManager.createTournament(
          Tier.STANDARD,
          period === 'weekly' ? Period.WEEKLY : Period.MONTHLY,
          startTime,
          endTime
        );
        const receipt1 = await tx1.wait();
        logger.info(`Standard ${period} tournament created on-chain`, { txHash: receipt1?.hash });

        // Create Firebase document for Standard
        const standardConfig = TOURNAMENT_CONFIG[period].standard;
        await createFirebaseTournament(
          nextId1.toString(),
          'standard',
          period,
          startTime,
          endTime,
          standardConfig.entryFee,
          standardConfig.prizePool,
          receipt1?.hash || ''
        );
        results.standard = { id: nextId1.toString(), txHash: receipt1?.hash || '' };
      } catch (onChainError) {
        logger.warn(`On-chain Standard ${period} creation failed, using Firebase-only fallback:`, onChainError);
        const fallback = await createFirebaseOnlyTournament('standard', period, startTime, endTime);
        results.standard = { id: fallback.id, txHash: '', isOffChain: true };
      }

      // Create High Roller Tournament - try on-chain first, fallback to Firebase-only
      try {
        const nextId2 = await tournamentManager.nextTournamentId();
        logger.info(`Creating High Roller ${period} tournament (ID: ${nextId2})...`);

        const tx2 = await tournamentManager.createTournament(
          Tier.HIGH_ROLLER,
          period === 'weekly' ? Period.WEEKLY : Period.MONTHLY,
          startTime,
          endTime
        );
        const receipt2 = await tx2.wait();
        logger.info(`High Roller ${period} tournament created on-chain`, { txHash: receipt2?.hash });

        // Create Firebase document for High Roller
        const highRollerConfig = TOURNAMENT_CONFIG[period].highRoller;
        await createFirebaseTournament(
          nextId2.toString(),
          'highRoller',
          period,
          startTime,
          endTime,
          highRollerConfig.entryFee,
          highRollerConfig.prizePool,
          receipt2?.hash || ''
        );
        results.highRoller = { id: nextId2.toString(), txHash: receipt2?.hash || '' };
      } catch (onChainError) {
        logger.warn(`On-chain High Roller ${period} creation failed, using Firebase-only fallback:`, onChainError);
        const fallback = await createFirebaseOnlyTournament('highRoller', period, startTime, endTime);
        results.highRoller = { id: fallback.id, txHash: '', isOffChain: true };
      }

      logger.info(`${period} tournaments created successfully!`, results);

      return {
        success: true,
        period,
        startTime: new Date(startTime * 1000).toISOString(),
        endTime: new Date(endTime * 1000).toISOString(),
        tournaments: results,
      };

    } catch (error) {
      logger.error(`Error creating ${period} tournaments:`, error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', `Failed to create ${period} tournaments: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
);

/**
 * Ensure Active Tournaments Exist
 *
 * Runs every hour to check if there are active tournaments.
 * If no active/upcoming tournaments exist for a period, creates them.
 *
 * This is more robust than relying on exact scheduled times:
 * - Handles missed schedules
 * - Handles deployment issues
 * - Self-healing if tournaments are missing
 */
export const ensureActiveTournaments = onSchedule(
  {
    schedule: 'every 1 hours', // Run every hour
    timeZone: 'UTC',
    region: 'us-central1',
    secrets: [deployerPrivateKey, tournamentManagerAddress],
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async () => {
    logger.info('Checking for missing tournaments...');

    try {
      // Get secrets
      const managerAddress = tournamentManagerAddress.value();
      const privateKey = deployerPrivateKey.value();
      const network = process.env.NETWORK || 'testnet';

      if (!managerAddress || !privateKey) {
        logger.error('Missing secrets - cannot create tournaments automatically');
        return;
      }

      const now = Date.now();

      // Check for active/upcoming weekly tournaments
      const weeklySnapshot = await db
        .collection('tournaments')
        .where('period', '==', 'weekly')
        .where('status', 'in', ['active', 'upcoming'])
        .get();

      const hasActiveWeekly = !weeklySnapshot.empty;
      logger.info(`Active weekly tournaments: ${weeklySnapshot.size}`);

      // Check for active/upcoming monthly tournaments
      const monthlySnapshot = await db
        .collection('tournaments')
        .where('period', '==', 'monthly')
        .where('status', 'in', ['active', 'upcoming'])
        .get();

      const hasActiveMonthly = !monthlySnapshot.empty;
      logger.info(`Active monthly tournaments: ${monthlySnapshot.size}`);

      // If both exist, nothing to do
      if (hasActiveWeekly && hasActiveMonthly) {
        logger.info('All tournaments exist - no action needed');
        return;
      }

      // Connect to blockchain
      const rpcUrl = network === 'mainnet' ? ARBITRUM_ONE_RPC : ARBITRUM_SEPOLIA_RPC;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      const tournamentManager = new ethers.Contract(
        managerAddress,
        TOURNAMENT_MANAGER_ABI,
        wallet
      );

      // Create missing weekly tournaments
      if (!hasActiveWeekly) {
        logger.info('Creating missing weekly tournaments...');
        const nowUnix = Math.floor(now / 1000);
        const startTime = nowUnix + 3600; // Start in 1 hour
        const endTime = startTime + (7 * 24 * 60 * 60); // 7 days

        // Standard Weekly - try on-chain first, fallback to Firebase-only
        try {
          const nextId1 = await tournamentManager.nextTournamentId();
          const tx1 = await tournamentManager.createTournament(
            Tier.STANDARD,
            Period.WEEKLY,
            startTime,
            endTime
          );
          const receipt1 = await tx1.wait();
          await createFirebaseTournament(
            nextId1.toString(),
            'standard',
            'weekly',
            startTime,
            endTime,
            TOURNAMENT_CONFIG.weekly.standard.entryFee,
            TOURNAMENT_CONFIG.weekly.standard.prizePool,
            receipt1?.hash || ''
          );
          logger.info(`Created Standard Weekly tournament ${nextId1} (on-chain)`);
        } catch (onChainError) {
          logger.warn('On-chain Standard Weekly creation failed, using Firebase-only fallback:', onChainError);
          await createFirebaseOnlyTournament('standard', 'weekly', startTime, endTime);
        }

        // High Roller Weekly - try on-chain first, fallback to Firebase-only
        try {
          const nextId2 = await tournamentManager.nextTournamentId();
          const tx2 = await tournamentManager.createTournament(
            Tier.HIGH_ROLLER,
            Period.WEEKLY,
            startTime,
            endTime
          );
          const receipt2 = await tx2.wait();
          await createFirebaseTournament(
            nextId2.toString(),
            'highRoller',
            'weekly',
            startTime,
            endTime,
            TOURNAMENT_CONFIG.weekly.highRoller.entryFee,
            TOURNAMENT_CONFIG.weekly.highRoller.prizePool,
            receipt2?.hash || ''
          );
          logger.info(`Created High Roller Weekly tournament ${nextId2} (on-chain)`);
        } catch (onChainError) {
          logger.warn('On-chain High Roller Weekly creation failed, using Firebase-only fallback:', onChainError);
          await createFirebaseOnlyTournament('highRoller', 'weekly', startTime, endTime);
        }
      }

      // Create missing monthly tournaments
      if (!hasActiveMonthly) {
        logger.info('Creating missing monthly tournaments...');
        const nowUnix = Math.floor(now / 1000);
        const startTime = nowUnix + 3600; // Start in 1 hour
        const endTime = startTime + (30 * 24 * 60 * 60); // 30 days

        // Standard Monthly - try on-chain first, fallback to Firebase-only
        try {
          const nextId3 = await tournamentManager.nextTournamentId();
          const tx3 = await tournamentManager.createTournament(
            Tier.STANDARD,
            Period.MONTHLY,
            startTime,
            endTime
          );
          const receipt3 = await tx3.wait();
          await createFirebaseTournament(
            nextId3.toString(),
            'standard',
            'monthly',
            startTime,
            endTime,
            TOURNAMENT_CONFIG.monthly.standard.entryFee,
            TOURNAMENT_CONFIG.monthly.standard.prizePool,
            receipt3?.hash || ''
          );
          logger.info(`Created Standard Monthly tournament ${nextId3} (on-chain)`);
        } catch (onChainError) {
          logger.warn('On-chain Standard Monthly creation failed, using Firebase-only fallback:', onChainError);
          await createFirebaseOnlyTournament('standard', 'monthly', startTime, endTime);
        }

        // High Roller Monthly - try on-chain first, fallback to Firebase-only
        try {
          const nextId4 = await tournamentManager.nextTournamentId();
          const tx4 = await tournamentManager.createTournament(
            Tier.HIGH_ROLLER,
            Period.MONTHLY,
            startTime,
            endTime
          );
          const receipt4 = await tx4.wait();
          await createFirebaseTournament(
            nextId4.toString(),
            'highRoller',
            'monthly',
            startTime,
            endTime,
            TOURNAMENT_CONFIG.monthly.highRoller.entryFee,
            TOURNAMENT_CONFIG.monthly.highRoller.prizePool,
            receipt4?.hash || ''
          );
          logger.info(`Created High Roller Monthly tournament ${nextId4} (on-chain)`);
        } catch (onChainError) {
          logger.warn('On-chain High Roller Monthly creation failed, using Firebase-only fallback:', onChainError);
          await createFirebaseOnlyTournament('highRoller', 'monthly', startTime, endTime);
        }
      }

      logger.info('Tournament check complete');

    } catch (error) {
      logger.error('Error in ensureActiveTournaments:', error);
      // Don't throw - scheduled functions shouldn't crash the whole system
    }
  }
);
