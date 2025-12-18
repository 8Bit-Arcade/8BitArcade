/**
 * Automated Tournament Creation
 *
 * This Cloud Function runs on a schedule to automatically create:
 * - Weekly tournaments (every Monday at 00:00 UTC)
 * - Monthly tournaments (every 1st of the month at 00:00 UTC)
 *
 * Both Standard and High Roller tiers are created for each period.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { ethers } from 'ethers';

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

// Network configuration
const ARBITRUM_SEPOLIA_RPC = 'https://sepolia-rollup.arbitrum.io/rpc';
const ARBITRUM_ONE_RPC = 'https://arb1.arbitrum.io/rpc';

/**
 * Create Weekly Tournaments
 * Runs every Monday at 00:00 UTC
 */
export const createWeeklyTournaments = onSchedule(
  {
    schedule: '0 0 * * 1', // Every Monday at midnight UTC
    timeZone: 'UTC',
    region: 'us-central1',
  },
  async (event) => {
    logger.info('Creating weekly tournaments...', { time: event.scheduleTime });

    try {
      // Get contract address and deployer key from environment
      const tournamentManagerAddress = process.env.TOURNAMENT_MANAGER_ADDRESS;
      const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
      const network = process.env.NETWORK || 'testnet';

      if (!tournamentManagerAddress || !deployerPrivateKey) {
        throw new Error('Missing environment variables: TOURNAMENT_MANAGER_ADDRESS or DEPLOYER_PRIVATE_KEY');
      }

      // Connect to network
      const rpcUrl = network === 'mainnet' ? ARBITRUM_ONE_RPC : ARBITRUM_SEPOLIA_RPC;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(deployerPrivateKey, provider);

      const tournamentManager = new ethers.Contract(
        tournamentManagerAddress,
        TOURNAMENT_MANAGER_ABI,
        wallet
      );

      // Calculate tournament period (next 7 days)
      const now = Math.floor(Date.now() / 1000);
      const startTime = now + 3600; // Start in 1 hour
      const endTime = startTime + (7 * 24 * 60 * 60); // 7 days duration

      // Create Standard Weekly Tournament
      logger.info('Creating Standard Weekly tournament...');
      const tx1 = await tournamentManager.createTournament(
        Tier.STANDARD,
        Period.WEEKLY,
        startTime,
        endTime
      );
      const receipt1 = await tx1.wait();
      logger.info('Standard Weekly tournament created', { txHash: receipt1?.hash });

      // Create High Roller Weekly Tournament
      logger.info('Creating High Roller Weekly tournament...');
      const tx2 = await tournamentManager.createTournament(
        Tier.HIGH_ROLLER,
        Period.WEEKLY,
        startTime,
        endTime
      );
      const receipt2 = await tx2.wait();
      logger.info('High Roller Weekly tournament created', { txHash: receipt2?.hash });

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
  },
  async (event) => {
    logger.info('Creating monthly tournaments...', { time: event.scheduleTime });

    try {
      // Get contract address and deployer key from environment
      const tournamentManagerAddress = process.env.TOURNAMENT_MANAGER_ADDRESS;
      const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
      const network = process.env.NETWORK || 'testnet';

      if (!tournamentManagerAddress || !deployerPrivateKey) {
        throw new Error('Missing environment variables: TOURNAMENT_MANAGER_ADDRESS or DEPLOYER_PRIVATE_KEY');
      }

      // Connect to network
      const rpcUrl = network === 'mainnet' ? ARBITRUM_ONE_RPC : ARBITRUM_SEPOLIA_RPC;
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(deployerPrivateKey, provider);

      const tournamentManager = new ethers.Contract(
        tournamentManagerAddress,
        TOURNAMENT_MANAGER_ABI,
        wallet
      );

      // Calculate tournament period (next 30 days)
      const now = Math.floor(Date.now() / 1000);
      const startTime = now + 3600; // Start in 1 hour
      const endTime = startTime + (30 * 24 * 60 * 60); // 30 days duration

      // Create Standard Monthly Tournament
      logger.info('Creating Standard Monthly tournament...');
      const tx1 = await tournamentManager.createTournament(
        Tier.STANDARD,
        Period.MONTHLY,
        startTime,
        endTime
      );
      const receipt1 = await tx1.wait();
      logger.info('Standard Monthly tournament created', { txHash: receipt1?.hash });

      // Create High Roller Monthly Tournament
      logger.info('Creating High Roller Monthly tournament...');
      const tx2 = await tournamentManager.createTournament(
        Tier.HIGH_ROLLER,
        Period.MONTHLY,
        startTime,
        endTime
      );
      const receipt2 = await tx2.wait();
      logger.info('High Roller Monthly tournament created', { txHash: receipt2?.hash });

      logger.info('Monthly tournaments created successfully!');

    } catch (error) {
      logger.error('Error creating monthly tournaments:', error);
      throw error;
    }
  }
);

/**
 * Manual tournament creation function (for testing or manual creation)
 * Can be called via Firebase Functions shell or HTTP trigger
 */
export const createTournamentManual = onSchedule(
  {
    schedule: 'every 24 hours', // Dummy schedule, won't actually run on schedule
    timeZone: 'UTC',
    region: 'us-central1',
  },
  async (event) => {
    logger.info('Manual tournament creation triggered');
    // This is a placeholder for manual testing
    // You can invoke this function manually for testing purposes
  }
);
