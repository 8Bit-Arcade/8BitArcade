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
  txHash: string
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
    txHash, // Store the blockchain transaction hash
  };

  await db.collection('tournaments').doc(tournamentId).set(tournament);
  logger.info(`Firebase tournament document created: ${tournamentId} (status: ${status})`);
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

      // Get next tournament ID before creating
      const nextId1 = await tournamentManager.nextTournamentId();

      // Create Standard Weekly Tournament
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

      // Get next tournament ID for High Roller
      const nextId2 = await tournamentManager.nextTournamentId();

      // Create High Roller Weekly Tournament
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

      logger.info('Weekly tournaments created successfully (on-chain + Firebase)!');

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

      // Get next tournament ID before creating
      const nextId1 = await tournamentManager.nextTournamentId();

      // Create Standard Monthly Tournament
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

      // Get next tournament ID for High Roller
      const nextId2 = await tournamentManager.nextTournamentId();

      // Create High Roller Monthly Tournament
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

      logger.info('Monthly tournaments created successfully (on-chain + Firebase)!');

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

      const results: { standard?: { id: string; txHash: string }; highRoller?: { id: string; txHash: string } } = {};

      // Create Standard Tournament
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

      // Create High Roller Tournament
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
