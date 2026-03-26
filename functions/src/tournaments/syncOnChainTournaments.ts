/**
 * Sync On-Chain Tournaments to Firebase
 *
 * One-time utility to sync existing blockchain tournaments to Firebase.
 * This is needed for tournaments created before Firebase sync was implemented.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { ethers } from 'ethers';
import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { TournamentDocument, TournamentTier, TournamentPeriod } from '../types';

const tournamentManagerAddress = defineSecret('TOURNAMENT_MANAGER_ADDRESS');

// Extended ABI for reading tournament data
const TOURNAMENT_MANAGER_ABI = [
  'function nextTournamentId() view returns (uint256)',
  'function tournaments(uint256) view returns (uint8 tier, uint8 period, uint256 startTime, uint256 endTime, uint256 prizePool, bool finalized)',
  'function getTournamentEntryFee(uint256 tournamentId) view returns (uint256)',
];

// Network configuration
const ARBITRUM_SEPOLIA_RPC = 'https://sepolia-rollup.arbitrum.io/rpc';
const ARBITRUM_ONE_RPC = 'https://arb1.arbitrum.io/rpc';

// Entry fees by tier (in 8BIT tokens - fallback if contract doesn't return)
const DEFAULT_ENTRY_FEES = {
  weekly: { standard: 2000, highRoller: 10000 },
  monthly: { standard: 10000, highRoller: 50000 },
};

const DEFAULT_PRIZE_POOLS = {
  weekly: { standard: 50000, highRoller: 150000 },
  monthly: { standard: 100000, highRoller: 500000 },
};

/**
 * Sync all on-chain tournaments to Firebase
 * Creates Firebase documents for tournaments that don't exist yet
 */
export const syncOnChainTournaments = onCall(
  {
    secrets: [tournamentManagerAddress],
  },
  async (request) => {
    logger.info('Starting on-chain tournament sync...');

    try {
      const managerAddress = tournamentManagerAddress.value();
      const network = process.env.NETWORK || 'testnet';

      if (!managerAddress) {
        throw new HttpsError('failed-precondition', 'TOURNAMENT_MANAGER_ADDRESS secret not set');
      }

      // Connect to network
      const rpcUrl = network === 'mainnet' ? ARBITRUM_ONE_RPC : ARBITRUM_SEPOLIA_RPC;
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      const tournamentManager = new ethers.Contract(
        managerAddress,
        TOURNAMENT_MANAGER_ABI,
        provider
      );

      // Get total number of tournaments
      const nextId = await tournamentManager.nextTournamentId();
      const totalTournaments = Number(nextId);

      logger.info(`Found ${totalTournaments} tournaments on-chain`);

      const results = {
        synced: 0,
        skipped: 0,
        errors: 0,
        details: [] as string[],
      };

      // Iterate through all tournaments
      for (let i = 0; i < totalTournaments; i++) {
        const tournamentId = i.toString();

        try {
          // Check if already exists in Firebase
          const existingDoc = await db.collection('tournaments').doc(tournamentId).get();

          if (existingDoc.exists) {
            results.skipped++;
            results.details.push(`Tournament ${tournamentId}: already exists in Firebase`);
            continue;
          }

          // Read tournament data from blockchain
          const [tier, period, startTime, endTime, prizePool, finalized] =
            await tournamentManager.tournaments(i);

          // Convert blockchain data to our types
          const tierStr: TournamentTier = tier === 0 ? 'standard' : 'highRoller';
          const periodStr: TournamentPeriod = period === 0 ? 'weekly' : 'monthly';

          // Determine status based on times and finalized flag
          const now = Math.floor(Date.now() / 1000);
          const startTimeNum = Number(startTime);
          const endTimeNum = Number(endTime);

          let status: 'upcoming' | 'active' | 'ended' | 'finalized';
          if (finalized) {
            status = 'finalized';
          } else if (endTimeNum <= now) {
            status = 'ended';
          } else if (startTimeNum <= now) {
            status = 'active';
          } else {
            status = 'upcoming';
          }

          // Get entry fee (use defaults as fallback)
          let entryFee: number;
          try {
            const fee = await tournamentManager.getTournamentEntryFee(i);
            entryFee = Number(fee) / 1e18; // Convert from wei if needed
          } catch {
            entryFee = DEFAULT_ENTRY_FEES[periodStr][tierStr];
          }

          // Use prize pool from contract or default
          const prizePoolNum = Number(prizePool) > 0
            ? Number(prizePool) / 1e18
            : DEFAULT_PRIZE_POOLS[periodStr][tierStr];

          // Create Firebase document
          const tournament: TournamentDocument = {
            id: tournamentId,
            tier: tierStr,
            period: periodStr,
            startTime: Timestamp.fromMillis(startTimeNum * 1000),
            endTime: Timestamp.fromMillis(endTimeNum * 1000),
            entryFee,
            prizePool: prizePoolNum,
            status,
            participants: [],
            createdAt: Timestamp.now(),
            finalizedAt: finalized ? Timestamp.now() : null,
            winnerId: null,
            txHash: 'synced-from-blockchain',
          };

          await db.collection('tournaments').doc(tournamentId).set(tournament);

          results.synced++;
          results.details.push(
            `Tournament ${tournamentId}: synced (${tierStr} ${periodStr}, status: ${status})`
          );

          logger.info(`Synced tournament ${tournamentId}: ${tierStr} ${periodStr} - ${status}`);

        } catch (error) {
          results.errors++;
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          results.details.push(`Tournament ${tournamentId}: ERROR - ${errorMsg}`);
          logger.error(`Error syncing tournament ${tournamentId}:`, error);
        }
      }

      logger.info(
        `Sync complete: ${results.synced} synced, ${results.skipped} skipped, ${results.errors} errors`
      );

      return {
        success: true,
        totalOnChain: totalTournaments,
        ...results,
      };

    } catch (error) {
      logger.error('Error in syncOnChainTournaments:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Failed to sync tournaments');
    }
  }
);
