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

// Network configuration - multiple RPC endpoints for fallback
const ARBITRUM_SEPOLIA_RPCS = [
  'https://sepolia-rollup.arbitrum.io/rpc',
  'https://arbitrum-sepolia.blockpi.network/v1/rpc/public',
];
const ARBITRUM_ONE_RPCS = [
  'https://arb1.arbitrum.io/rpc',
  'https://arbitrum.blockpi.network/v1/rpc/public',
  'https://1rpc.io/arb',
];

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000; // Start with 2 seconds, exponential backoff

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute a transaction with retry logic
 */
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`${operationName} - attempt ${attempt}/${maxRetries}`);
      const result = await operation();
      logger.info(`${operationName} - succeeded on attempt ${attempt}`);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn(`${operationName} - attempt ${attempt} failed:`, {
        error: lastError.message,
        attempt,
        maxRetries,
      });

      if (attempt < maxRetries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
        logger.info(`${operationName} - retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  logger.error(`${operationName} - all ${maxRetries} attempts failed`);
  throw lastError;
}

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
 * Create Weekly Tournaments
 * Runs every Monday at 00:00 UTC
 */
export const createWeeklyTournaments = onSchedule(
  {
    schedule: '0 0 * * 1', // Every Monday at midnight UTC
    timeZone: 'UTC',
    region: 'us-central1',
    secrets: [deployerPrivateKey, tournamentManagerAddress],
    memory: '512MiB',
    timeoutSeconds: 300, // 5 minutes to allow for retries and tx confirmation
  },
  async (event) => {
    logger.info('Creating weekly tournaments...', { time: event.scheduleTime });

    try {
      // Get secrets
      const managerAddress = tournamentManagerAddress.value();
      const privateKey = deployerPrivateKey.value();
      const network = process.env.NETWORK || 'testnet';
      const isMainnet = network === 'mainnet';

      if (!managerAddress || !privateKey) {
        throw new Error('Missing secrets: TOURNAMENT_MANAGER_ADDRESS or DEPLOYER_PRIVATE_KEY. Run: firebase functions:secrets:set <SECRET_NAME>');
      }

      logger.info(`Connecting to ${isMainnet ? 'mainnet' : 'testnet'}...`);

      // Connect to network with fallback RPCs
      const rpcs = isMainnet ? ARBITRUM_ONE_RPCS : ARBITRUM_SEPOLIA_RPCS;
      const provider = new ethers.JsonRpcProvider(rpcs[0]);
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

      // Create Standard Weekly Tournament with retry
      const { id: standardId, txHash: standardTxHash } = await executeWithRetry(
        async () => {
          const nextId = await tournamentManager.nextTournamentId();
          logger.info(`Creating Standard Weekly tournament (ID: ${nextId})...`);
          const tx = await tournamentManager.createTournament(
            Tier.STANDARD,
            Period.WEEKLY,
            startTime,
            endTime
          );
          const receipt = await tx.wait();
          return { id: nextId.toString(), txHash: receipt?.hash || '' };
        },
        'Create Standard Weekly Tournament'
      );

      // Create Firebase document for Standard Weekly
      const standardConfig = TOURNAMENT_CONFIG.weekly.standard;
      await createFirebaseTournament(
        standardId,
        'standard',
        'weekly',
        startTime,
        endTime,
        standardConfig.entryFee,
        standardConfig.prizePool,
        standardTxHash
      );
      logger.info(`Standard Weekly tournament ${standardId} created on-chain`, { txHash: standardTxHash });

      // Create High Roller Weekly Tournament with retry
      const { id: highRollerId, txHash: highRollerTxHash } = await executeWithRetry(
        async () => {
          const nextId = await tournamentManager.nextTournamentId();
          logger.info(`Creating High Roller Weekly tournament (ID: ${nextId})...`);
          const tx = await tournamentManager.createTournament(
            Tier.HIGH_ROLLER,
            Period.WEEKLY,
            startTime,
            endTime
          );
          const receipt = await tx.wait();
          return { id: nextId.toString(), txHash: receipt?.hash || '' };
        },
        'Create High Roller Weekly Tournament'
      );

      // Create Firebase document for High Roller Weekly
      const highRollerConfig = TOURNAMENT_CONFIG.weekly.highRoller;
      await createFirebaseTournament(
        highRollerId,
        'highRoller',
        'weekly',
        startTime,
        endTime,
        highRollerConfig.entryFee,
        highRollerConfig.prizePool,
        highRollerTxHash
      );
      logger.info(`High Roller Weekly tournament ${highRollerId} created on-chain`, { txHash: highRollerTxHash });

      logger.info('Weekly tournaments created successfully!', {
        standard: { id: standardId, txHash: standardTxHash },
        highRoller: { id: highRollerId, txHash: highRollerTxHash },
      });

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
    secrets: [deployerPrivateKey, tournamentManagerAddress],
    memory: '512MiB',
    timeoutSeconds: 300, // 5 minutes to allow for retries and tx confirmation
  },
  async (event) => {
    logger.info('Creating monthly tournaments...', { time: event.scheduleTime });

    try {
      // Get secrets
      const managerAddress = tournamentManagerAddress.value();
      const privateKey = deployerPrivateKey.value();
      const network = process.env.NETWORK || 'testnet';
      const isMainnet = network === 'mainnet';

      if (!managerAddress || !privateKey) {
        throw new Error('Missing secrets: TOURNAMENT_MANAGER_ADDRESS or DEPLOYER_PRIVATE_KEY. Run: firebase functions:secrets:set <SECRET_NAME>');
      }

      logger.info(`Connecting to ${isMainnet ? 'mainnet' : 'testnet'}...`);

      // Connect to network with fallback RPCs
      const rpcs = isMainnet ? ARBITRUM_ONE_RPCS : ARBITRUM_SEPOLIA_RPCS;
      const provider = new ethers.JsonRpcProvider(rpcs[0]);
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

      // Create Standard Monthly Tournament with retry
      const { id: standardId, txHash: standardTxHash } = await executeWithRetry(
        async () => {
          const nextId = await tournamentManager.nextTournamentId();
          logger.info(`Creating Standard Monthly tournament (ID: ${nextId})...`);
          const tx = await tournamentManager.createTournament(
            Tier.STANDARD,
            Period.MONTHLY,
            startTime,
            endTime
          );
          const receipt = await tx.wait();
          return { id: nextId.toString(), txHash: receipt?.hash || '' };
        },
        'Create Standard Monthly Tournament'
      );

      // Create Firebase document for Standard Monthly
      const standardConfig = TOURNAMENT_CONFIG.monthly.standard;
      await createFirebaseTournament(
        standardId,
        'standard',
        'monthly',
        startTime,
        endTime,
        standardConfig.entryFee,
        standardConfig.prizePool,
        standardTxHash
      );
      logger.info(`Standard Monthly tournament ${standardId} created on-chain`, { txHash: standardTxHash });

      // Create High Roller Monthly Tournament with retry
      const { id: highRollerId, txHash: highRollerTxHash } = await executeWithRetry(
        async () => {
          const nextId = await tournamentManager.nextTournamentId();
          logger.info(`Creating High Roller Monthly tournament (ID: ${nextId})...`);
          const tx = await tournamentManager.createTournament(
            Tier.HIGH_ROLLER,
            Period.MONTHLY,
            startTime,
            endTime
          );
          const receipt = await tx.wait();
          return { id: nextId.toString(), txHash: receipt?.hash || '' };
        },
        'Create High Roller Monthly Tournament'
      );

      // Create Firebase document for High Roller Monthly
      const highRollerConfig = TOURNAMENT_CONFIG.monthly.highRoller;
      await createFirebaseTournament(
        highRollerId,
        'highRoller',
        'monthly',
        startTime,
        endTime,
        highRollerConfig.entryFee,
        highRollerConfig.prizePool,
        highRollerTxHash
      );
      logger.info(`High Roller Monthly tournament ${highRollerId} created on-chain`, { txHash: highRollerTxHash });

      logger.info('Monthly tournaments created successfully!', {
        standard: { id: standardId, txHash: standardTxHash },
        highRoller: { id: highRollerId, txHash: highRollerTxHash },
      });

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
    timeoutSeconds: 300, // 5 minutes for retries
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
      const isMainnet = network === 'mainnet';

      if (!managerAddress || !privateKey) {
        throw new HttpsError(
          'failed-precondition',
          'Missing secrets: TOURNAMENT_MANAGER_ADDRESS or DEPLOYER_PRIVATE_KEY. Run: firebase functions:secrets:set <SECRET_NAME>'
        );
      }

      logger.info(`Connecting to ${isMainnet ? 'mainnet' : 'testnet'}...`);

      // Connect to network with fallback RPCs
      const rpcs = isMainnet ? ARBITRUM_ONE_RPCS : ARBITRUM_SEPOLIA_RPCS;
      const provider = new ethers.JsonRpcProvider(rpcs[0]);
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

      const results: { standard?: { id: string; txHash: string }; highRoller?: { id: string; txHash: string } } = {};

      // Create Standard Tournament with retry
      const { id: standardId, txHash: standardTxHash } = await executeWithRetry(
        async () => {
          const nextId = await tournamentManager.nextTournamentId();
          logger.info(`Creating Standard ${period} tournament (ID: ${nextId})...`);
          const tx = await tournamentManager.createTournament(
            Tier.STANDARD,
            period === 'weekly' ? Period.WEEKLY : Period.MONTHLY,
            startTime,
            endTime
          );
          const receipt = await tx.wait();
          return { id: nextId.toString(), txHash: receipt?.hash || '' };
        },
        `Create Standard ${period} Tournament`
      );

      // Create Firebase document for Standard
      const standardConfig = TOURNAMENT_CONFIG[period].standard;
      await createFirebaseTournament(
        standardId,
        'standard',
        period,
        startTime,
        endTime,
        standardConfig.entryFee,
        standardConfig.prizePool,
        standardTxHash
      );
      results.standard = { id: standardId, txHash: standardTxHash };
      logger.info(`Standard ${period} tournament ${standardId} created on-chain`, { txHash: standardTxHash });

      // Create High Roller Tournament with retry
      const { id: highRollerId, txHash: highRollerTxHash } = await executeWithRetry(
        async () => {
          const nextId = await tournamentManager.nextTournamentId();
          logger.info(`Creating High Roller ${period} tournament (ID: ${nextId})...`);
          const tx = await tournamentManager.createTournament(
            Tier.HIGH_ROLLER,
            period === 'weekly' ? Period.WEEKLY : Period.MONTHLY,
            startTime,
            endTime
          );
          const receipt = await tx.wait();
          return { id: nextId.toString(), txHash: receipt?.hash || '' };
        },
        `Create High Roller ${period} Tournament`
      );

      // Create Firebase document for High Roller
      const highRollerConfig = TOURNAMENT_CONFIG[period].highRoller;
      await createFirebaseTournament(
        highRollerId,
        'highRoller',
        period,
        startTime,
        endTime,
        highRollerConfig.entryFee,
        highRollerConfig.prizePool,
        highRollerTxHash
      );
      results.highRoller = { id: highRollerId, txHash: highRollerTxHash };
      logger.info(`High Roller ${period} tournament ${highRollerId} created on-chain`, { txHash: highRollerTxHash });

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
    timeoutSeconds: 300, // 5 minutes for retries
  },
  async () => {
    logger.info('Checking for missing tournaments...');

    try {
      // Get secrets
      const managerAddress = tournamentManagerAddress.value();
      const privateKey = deployerPrivateKey.value();
      const network = process.env.NETWORK || 'testnet';
      const isMainnet = network === 'mainnet';

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

      logger.info(`Connecting to ${isMainnet ? 'mainnet' : 'testnet'}...`);

      // Connect to blockchain with fallback RPCs
      const rpcs = isMainnet ? ARBITRUM_ONE_RPCS : ARBITRUM_SEPOLIA_RPCS;
      const provider = new ethers.JsonRpcProvider(rpcs[0]);
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

        // Standard Weekly with retry
        const { id: standardId, txHash: standardTxHash } = await executeWithRetry(
          async () => {
            const nextId = await tournamentManager.nextTournamentId();
            const tx = await tournamentManager.createTournament(
              Tier.STANDARD,
              Period.WEEKLY,
              startTime,
              endTime
            );
            const receipt = await tx.wait();
            return { id: nextId.toString(), txHash: receipt?.hash || '' };
          },
          'Ensure Standard Weekly Tournament'
        );
        await createFirebaseTournament(
          standardId,
          'standard',
          'weekly',
          startTime,
          endTime,
          TOURNAMENT_CONFIG.weekly.standard.entryFee,
          TOURNAMENT_CONFIG.weekly.standard.prizePool,
          standardTxHash
        );
        logger.info(`Created Standard Weekly tournament ${standardId} (on-chain)`, { txHash: standardTxHash });

        // High Roller Weekly with retry
        const { id: highRollerId, txHash: highRollerTxHash } = await executeWithRetry(
          async () => {
            const nextId = await tournamentManager.nextTournamentId();
            const tx = await tournamentManager.createTournament(
              Tier.HIGH_ROLLER,
              Period.WEEKLY,
              startTime,
              endTime
            );
            const receipt = await tx.wait();
            return { id: nextId.toString(), txHash: receipt?.hash || '' };
          },
          'Ensure High Roller Weekly Tournament'
        );
        await createFirebaseTournament(
          highRollerId,
          'highRoller',
          'weekly',
          startTime,
          endTime,
          TOURNAMENT_CONFIG.weekly.highRoller.entryFee,
          TOURNAMENT_CONFIG.weekly.highRoller.prizePool,
          highRollerTxHash
        );
        logger.info(`Created High Roller Weekly tournament ${highRollerId} (on-chain)`, { txHash: highRollerTxHash });
      }

      // Create missing monthly tournaments
      if (!hasActiveMonthly) {
        logger.info('Creating missing monthly tournaments...');
        const nowUnix = Math.floor(now / 1000);
        const startTime = nowUnix + 3600; // Start in 1 hour
        const endTime = startTime + (30 * 24 * 60 * 60); // 30 days

        // Standard Monthly with retry
        const { id: standardId, txHash: standardTxHash } = await executeWithRetry(
          async () => {
            const nextId = await tournamentManager.nextTournamentId();
            const tx = await tournamentManager.createTournament(
              Tier.STANDARD,
              Period.MONTHLY,
              startTime,
              endTime
            );
            const receipt = await tx.wait();
            return { id: nextId.toString(), txHash: receipt?.hash || '' };
          },
          'Ensure Standard Monthly Tournament'
        );
        await createFirebaseTournament(
          standardId,
          'standard',
          'monthly',
          startTime,
          endTime,
          TOURNAMENT_CONFIG.monthly.standard.entryFee,
          TOURNAMENT_CONFIG.monthly.standard.prizePool,
          standardTxHash
        );
        logger.info(`Created Standard Monthly tournament ${standardId} (on-chain)`, { txHash: standardTxHash });

        // High Roller Monthly with retry
        const { id: highRollerId, txHash: highRollerTxHash } = await executeWithRetry(
          async () => {
            const nextId = await tournamentManager.nextTournamentId();
            const tx = await tournamentManager.createTournament(
              Tier.HIGH_ROLLER,
              Period.MONTHLY,
              startTime,
              endTime
            );
            const receipt = await tx.wait();
            return { id: nextId.toString(), txHash: receipt?.hash || '' };
          },
          'Ensure High Roller Monthly Tournament'
        );
        await createFirebaseTournament(
          highRollerId,
          'highRoller',
          'monthly',
          startTime,
          endTime,
          TOURNAMENT_CONFIG.monthly.highRoller.entryFee,
          TOURNAMENT_CONFIG.monthly.highRoller.prizePool,
          highRollerTxHash
        );
        logger.info(`Created High Roller Monthly tournament ${highRollerId} (on-chain)`, { txHash: highRollerTxHash });
      }

      logger.info('Tournament check complete');

    } catch (error) {
      logger.error('Error in ensureActiveTournaments:', error);
      // Don't throw - scheduled functions shouldn't crash the whole system
    }
  }
);
