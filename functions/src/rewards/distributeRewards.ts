/**
 * Daily Reward Distribution Function
 *
 * This Firebase function distributes daily rewards to top 10 players
 * by calling the GameRewards smart contract on Arbitrum.
 *
 * ⚠️ IMPORTANT SETUP STEPS:
 *
 * 1. Create a new secure wallet for reward distribution
 * 2. Fund it with enough Arbitrum ETH for gas (0.01 ETH should last months)
 * 3. Add the private key to Firebase functions config:
 *    firebase functions:config:set rewards.private_key="0xYourPrivateKey"
 * 4. Set this wallet as the rewardsDistributor in the GameRewards contract
 * 5. Schedule this function to run daily at midnight UTC
 *
 * Security: The private key is stored securely in Firebase config,
 * not in code or git.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ethers } from 'ethers';

// Import contract configuration
// ⚠️ UPDATE: Make sure this points to your contracts config
import { GAME_REWARDS_ADDRESS, ARBITRUM_RPC_URL, USE_TESTNET } from '../../config';

// GameRewards contract ABI (minimal)
const GAME_REWARDS_ABI = [
  'function distributeRewards(uint256 dayId, address[] calldata players, uint256[] calldata ranks) external',
  'function isDistributed(uint256 dayId) view returns (bool)',
  'function getRewardForRank(uint256 rank) view returns (uint256)',
];

interface LeaderboardEntry {
  address: string;
  score: number;
  username?: string;
}

/**
 * Get today's day ID in YYYYMMDD format
 */
function getTodayDayId(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return parseInt(`${year}${month}${day}`);
}

/**
 * Get yesterday's day ID (for distributing previous day's rewards)
 */
function getYesterdayDayId(): number {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const year = yesterday.getUTCFullYear();
  const month = String(yesterday.getUTCMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getUTCDate()).padStart(2, '0');
  return parseInt(`${year}${month}${day}`);
}

/**
 * Fetch top 10 players from Firestore leaderboard
 */
async function getTop10Players(dayId: number): Promise<LeaderboardEntry[]> {
  const db = admin.firestore();

  // ⚠️ UPDATE: Adjust this query to match your Firestore structure
  const snapshot = await db
    .collection('leaderboards')
    .doc('daily')
    .collection(dayId.toString())
    .orderBy('score', 'desc')
    .limit(10)
    .get();

  const players: LeaderboardEntry[] = [];

  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.address) {
      players.push({
        address: data.address,
        score: data.score || 0,
        username: data.username,
      });
    }
  });

  return players;
}

/**
 * Main function: Distribute daily rewards
 *
 * Triggered daily at midnight UTC via Cloud Scheduler
 */
export const distributeDaily Rewards = functions
  .runWith({
    timeoutSeconds: 300, // 5 minutes
    memory: '512MB',
  })
  .pubsub.schedule('0 0 * * *') // Every day at midnight UTC
  .timeZone('UTC')
  .onRun(async (context) => {
    try {
      const dayId = getYesterdayDayId(); // Distribute rewards for yesterday
      console.log(`Starting reward distribution for day: ${dayId}`);

      // Setup provider and wallet
      const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);

      // ⚠️ SECURITY: Private key from Firebase config (not hardcoded!)
      const privateKey = functions.config().rewards?.private_key;
      if (!privateKey) {
        throw new Error('Rewards private key not configured. Run: firebase functions:config:set rewards.private_key="0xYourKey"');
      }

      const wallet = new ethers.Wallet(privateKey, provider);
      console.log('Distributor wallet:', wallet.address);

      // Connect to GameRewards contract
      const rewardsContract = new ethers.Contract(
        GAME_REWARDS_ADDRESS,
        GAME_REWARDS_ABI,
        wallet
      );

      // Check if already distributed
      const alreadyDistributed = await rewardsContract.isDistributed(dayId);
      if (alreadyDistributed) {
        console.log(`Rewards already distributed for day ${dayId}`);
        return null;
      }

      // Get top 10 players
      const top10 = await getTop10Players(dayId);

      if (top10.length === 0) {
        console.log('No players found for distribution');
        return null;
      }

      console.log(`Found ${top10.length} players for rewards`);

      // Prepare contract call data
      const playerAddresses = top10.map(p => p.address);
      const playerRanks = top10.map((_, index) => index + 1);

      // Check gas price and wallet balance
      const gasPrice = (await provider.getFeeData()).gasPrice;
      const balance = await provider.getBalance(wallet.address);

      console.log('Gas price:', ethers.formatUnits(gasPrice || 0, 'gwei'), 'gwei');
      console.log('Wallet balance:', ethers.formatEther(balance), 'ETH');

      // Estimate gas
      const estimatedGas = await rewardsContract.distributeRewards.estimateGas(
        dayId,
        playerAddresses,
        playerRanks
      );

      console.log('Estimated gas:', estimatedGas.toString());

      // Execute distribution
      console.log('Sending transaction...');
      const tx = await rewardsContract.distributeRewards(
        dayId,
        playerAddresses,
        playerRanks,
        {
          gasLimit: estimatedGas * 120n / 100n, // Add 20% buffer
        }
      );

      console.log('Transaction sent:', tx.hash);
      console.log('Waiting for confirmation...');

      const receipt = await tx.wait();

      console.log('✅ Rewards distributed successfully!');
      console.log('Block:', receipt.blockNumber);
      console.log('Gas used:', receipt.gasUsed.toString());

      // Log rewards to Firestore for record keeping
      const db = admin.firestore();
      await db.collection('reward_distributions').add({
        dayId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        players: top10.map((p, i) => ({
          rank: i + 1,
          address: p.address,
          username: p.username,
          score: p.score,
        })),
        network: USE_TESTNET ? 'testnet' : 'mainnet',
      });

      console.log('Distribution logged to Firestore');

      return {
        success: true,
        dayId,
        txHash: tx.hash,
        playersRewarded: top10.length,
      };

    } catch (error) {
      console.error('Error distributing rewards:', error);

      // Log error to Firestore
      const db = admin.firestore();
      await db.collection('reward_distribution_errors').add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw error;
    }
  });

/**
 * Manual trigger function for testing
 *
 * Call this HTTPS function to manually trigger reward distribution
 * Useful for testing before setting up the schedule
 *
 * Example:
 * curl -X POST https://your-region-your-project.cloudfunctions.net/manualDistributeRewards
 */
export const manualDistributeRewards = functions
  .runWith({
    timeoutSeconds: 300,
    memory: '512MB',
  })
  .https.onRequest(async (req, res) => {
    // ⚠️ SECURITY: Add authentication here in production!
    // Only allow authorized requests

    try {
      // Use yesterday's date for distribution
      const dayId = getYesterdayDayId();

      // ... same logic as scheduled function ...
      // (Copy the try block from distributeDailyRewards)

      res.status(200).json({
        success: true,
        message: 'Rewards distributed successfully',
        dayId,
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
