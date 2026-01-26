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

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { ethers } from 'ethers';

// Import contract configuration
import { GAME_REWARDS_ADDRESS, ARBITRUM_RPC_URL, USE_TESTNET } from '../config';

// Define the secret for the rewards private key
// Set this with: firebase functions:secrets:set REWARDS_PRIVATE_KEY
const rewardsPrivateKey = defineSecret('REWARDS_PRIVATE_KEY');

// Import Discord webhook integration
import { postWinnersToDiscord } from '../notifications/discordWebhook';

// Import Treasury gas manager
import { ensureGasFunding, logTreasuryStatus, getTreasuryAddress } from '../utils/treasuryManager';

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
  displayName?: string; // User's preferred display (username, ENS, or address)
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
 *
 * Data lives in globalLeaderboard/daily.entries[]
 */
async function getTop10Players(dayId: number): Promise<LeaderboardEntry[]> {
  const db = admin.firestore();
  const players: LeaderboardEntry[] = [];

  try {
    // Get global daily leaderboard
    const globalDailyDoc = await db.collection('globalLeaderboard').doc('daily').get();

    if (!globalDailyDoc.exists) {
      console.log('No global daily leaderboard found');
      return [];
    }

    const data = globalDailyDoc.data();
    const entries = data?.entries || [];

    // Get top 10 entries sorted by score
    const top10Entries = entries
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 10);

    // Fetch display preferences for each player
    for (const entry of top10Entries) {
      // Field is 'odedId' in your data structure
      const address = entry.odedId || entry.address;
      if (!address) continue;

      let displayName = address;

      try {
        const userDoc = await db.collection('users').doc(address.toLowerCase()).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          const displayPreference = userData?.displayPreference || 'address';

          if (displayPreference === 'username' && userData?.username) {
            displayName = userData.username;
          } else if (displayPreference === 'ens' && userData?.ensName) {
            displayName = userData.ensName;
          }
        }
      } catch (error) {
        console.warn(`Failed to fetch display preference for ${address}:`, error);
      }

      players.push({
        address: address,
        score: entry.score || 0,
        username: entry.username,
        displayName,
      });
    }

    console.log(`Found ${players.length} players for rewards distribution`);
    return players;

  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
}

/**
 * Main function: Distribute daily rewards
 *
 * Triggered daily at midnight UTC via Cloud Scheduler
 *
 * SETUP: Set the secret with:
 *   firebase functions:secrets:set REWARDS_PRIVATE_KEY
 */
export const distributeDailyRewards = onSchedule(
  {
    schedule: '0 0 * * *', // Every day at midnight UTC
    timeZone: 'UTC',
    timeoutSeconds: 300,
    memory: '512MiB',
    secrets: [rewardsPrivateKey], // Inject the secret
  },
  async (event) => {
    try {
      const dayId = getYesterdayDayId(); // Distribute rewards for yesterday
      console.log(`Starting reward distribution for day: ${dayId}`);

      // Setup provider and wallet
      const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);

      // Get private key from secret (new Firebase secrets API)
      const privateKey = rewardsPrivateKey.value();
      if (!privateKey) {
        throw new Error('Rewards private key not configured. Run: firebase functions:secrets:set REWARDS_PRIVATE_KEY');
      }

      const wallet = new ethers.Wallet(privateKey, provider);
      console.log('Distributor wallet:', wallet.address);

      // === AUTO-REFILL GAS WALLET ===
      // Check if treasury is configured and ensure gas funding
      try {
        const treasuryAddress = getTreasuryAddress();
        console.log('Treasury contract:', treasuryAddress);

        // Ensure payout wallet has sufficient gas
        const { refilled, status } = await ensureGasFunding(provider, treasuryAddress, wallet);

        if (refilled) {
          console.log(`✅ Payout wallet refilled: ${status.payoutBalance} ETH`);
        }

        // Log full treasury status for monitoring
        await logTreasuryStatus(provider, treasuryAddress);

      } catch (treasuryError: any) {
        // Treasury not configured or error - log warning but continue
        // This allows backward compatibility if treasury isn't set up yet
        console.warn('Treasury auto-refill not available:', treasuryError.message);
        console.warn('Continuing with manual gas management...');

        // Check if wallet has enough gas manually
        const balance = await provider.getBalance(wallet.address);
        if (balance < ethers.parseEther("0.01")) {
          console.error('⚠️  WARNING: Wallet balance is very low:', ethers.formatEther(balance), 'ETH');
          console.error('Please fund the wallet or configure TreasuryGasManager');
        }
      }

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
        return;
      }

      // Get top 10 players
      const top10 = await getTop10Players(dayId);

      if (top10.length === 0) {
        console.log('No players found for distribution');
        return;
      }

      console.log(`Found ${top10.length} players for rewards`);

      // Prepare contract call data
      const playerAddresses = top10.map(p => p.address);
      const playerRanks = top10.map((_, index) => index + 1);

      // Check gas price
      const gasPrice = (await provider.getFeeData()).gasPrice;
      console.log('Gas price:', ethers.formatUnits(gasPrice || 0, 'gwei'), 'gwei');

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

      // Post winners to Discord for transparency
      try {
        const networkExplorerUrl = USE_TESTNET
          ? 'https://sepolia.arbiscan.io'
          : 'https://arbiscan.io';

        // Get reward amounts for each rank from contract
        const winnersWithRewards = await Promise.all(
          top10.map(async (p, i) => {
            const rank = i + 1;
            const rewardAmount = await rewardsContract.getRewardForRank(rank);
            return {
              rank,
              address: p.address,
              score: p.score,
              reward: ethers.formatEther(rewardAmount),
              displayName: p.displayName,
            };
          })
        );

        await postWinnersToDiscord(
          winnersWithRewards,
          'All Games', // Can be game-specific if you distribute per-game
          tx.hash,
          dayId,
          networkExplorerUrl
        );

        console.log('✅ Winners posted to Discord');
      } catch (discordError) {
        console.error('Discord notification failed (non-critical):', discordError);
        // Don't fail the whole function if Discord fails
      }

      console.log(`✅ Distribution complete: dayId=${dayId}, txHash=${tx.hash}, players=${top10.length}`);

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
export const manualDistributeRewards = onRequest(
  {
    timeoutSeconds: 300,
    memory: '512MiB',
    secrets: [rewardsPrivateKey],
  },
  async (req, res) => {
    // ⚠️ SECURITY: Add authentication here in production!
    // Only allow authorized requests

    try {
      const dayId = getYesterdayDayId();
      console.log(`Manual distribution for day: ${dayId}`);

      // Setup provider and wallet
      const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
      const privateKey = rewardsPrivateKey.value();

      if (!privateKey) {
        res.status(500).json({ success: false, error: 'Private key not configured' });
        return;
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
        res.status(200).json({ success: true, message: `Already distributed for day ${dayId}` });
        return;
      }

      // Get top 10 players
      const top10 = await getTop10Players(dayId);
      if (top10.length === 0) {
        res.status(200).json({ success: true, message: 'No players found for distribution' });
        return;
      }

      // Prepare and execute distribution
      const playerAddresses = top10.map(p => p.address);
      const playerRanks = top10.map((_, index) => index + 1);

      const tx = await rewardsContract.distributeRewards(dayId, playerAddresses, playerRanks);
      console.log('Transaction sent:', tx.hash);
      const receipt = await tx.wait();

      // Log to Firestore
      const db = admin.firestore();
      await db.collection('reward_distributions').add({
        dayId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        players: top10.map((p, i) => ({ rank: i + 1, address: p.address, score: p.score })),
        manual: true,
      });

      res.status(200).json({
        success: true,
        message: 'Rewards distributed successfully',
        dayId,
        txHash: tx.hash,
        playersRewarded: top10.length,
      });

    } catch (error) {
      console.error('Manual distribution error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * TEST ONLY: Check leaderboard data without distributing
 *
 * Use this to debug what data exists in your leaderboard
 * Pass ?date=today or ?date=YYYYMMDD to check specific days
 */
export const testCheckLeaderboard = onRequest(
  {
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (req, res) => {
    try {
      const db = admin.firestore();

      // Get dayId from query param or use today
      let dayId: number;
      const dateParam = req.query.date as string;

      if (dateParam === 'today') {
        const today = new Date();
        const year = today.getUTCFullYear();
        const month = String(today.getUTCMonth() + 1).padStart(2, '0');
        const day = String(today.getUTCDate()).padStart(2, '0');
        dayId = parseInt(`${year}${month}${day}`);
      } else if (dateParam) {
        dayId = parseInt(dateParam);
      } else {
        dayId = getYesterdayDayId();
      }

      console.log(`Checking leaderboard for dayId: ${dayId}`);

      // Try the expected path
      const expectedPath = `leaderboards/daily/${dayId}`;
      const snapshot = await db
        .collection('leaderboards')
        .doc('daily')
        .collection(dayId.toString())
        .orderBy('score', 'desc')
        .limit(10)
        .get();

      const players = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Also check what collections exist under leaderboards
      const leaderboardsDoc = await db.collection('leaderboards').doc('daily').get();
      const subcollections = await db.collection('leaderboards').doc('daily').listCollections();
      const subcollectionNames = subcollections.map(c => c.id).slice(0, 10); // First 10

      // Check globalLeaderboard too
      const globalDaily = await db.collection('globalLeaderboard').doc('daily').get();

      res.status(200).json({
        success: true,
        dayId,
        expectedPath,
        playersFound: players.length,
        players,
        debug: {
          leaderboardsDailyExists: leaderboardsDoc.exists,
          subcollections: subcollectionNames,
          globalLeaderboardDaily: globalDaily.exists ? globalDaily.data() : null,
        }
      });

    } catch (error) {
      console.error('Test check error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);
