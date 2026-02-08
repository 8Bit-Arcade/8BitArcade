import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, Timestamp } from '../config/firebase';
import { keccak256, encodePacked } from 'viem';
import { ethers } from 'ethers';
import { STAKING_ADDRESS, ARBITRUM_RPC_URL } from '../config';

/**
 * Airdrop Calculation System for 8-Bit Arcade Testnet Rewards
 *
 * Allocates 10 million 8BIT tokens to testnet participants
 * based on their activity and achievements.
 *
 * === NEW PROPORTIONAL SYSTEM - NO CAPS ===
 *
 * Point System (NO LIMITS - earn as much as you can!):
 * - Games Played: 1 point each (NO CAP)
 * - High Score Rankings: 10-50 points per game
 * - Tournament Entries: 25 points each
 * - Tournament Top 10 Finish: 100 points each
 * - Early Adopter Bonus: 2x multiplier for first 100 users
 * - Discord Activity: 5-100 points based on message count
 * - Telegram Activity: 5-100 points based on message count
 * - Staking: 10-200 points based on amount + lock duration
 *
 * === BREADTH BONUS (Use Multiple Methods = More Rewards) ===
 * Using more participation methods gives you a multiplier:
 * - 1 method: 1.0x
 * - 2 methods: 1.2x
 * - 3 methods: 1.4x
 * - 4 methods: 1.6x
 * - 5 methods: 1.8x
 * - 6 methods (all): 2.0x BONUS!
 *
 * Methods: Gaming, Tournaments, High Scores, Discord, Telegram, Staking
 *
 * === PROPORTIONAL DISTRIBUTION ===
 * Tokens distributed proportionally based on weighted points (points x breadth multiplier)
 * No fixed tier caps - if you earn more, you get more!
 * Tier labels (Legendary/Epic/Rare/Common) are for display only, based on rank position.
 *
 * === EXCLUDED ACCOUNTS ===
 * Owner/team wallets are tracked but excluded from rewards.
 * Their points are automatically redistributed to other participants.
 *
 * Minimum eligibility: 5 games played OR 1 tournament entry OR 50 Discord/Telegram messages OR active stake (with linked wallet)
 */

// Constants
const TOTAL_AIRDROP_TOKENS = 10_000_000; // 10 million tokens
const TOKENS_DECIMALS = 18;

// NO POINT CAPS - Users who try hard should be rewarded proportionally
// Removed: MAX_GAME_POINTS, DIMINISHING_RETURNS_THRESHOLD

// Minimum eligibility
const MIN_GAMES_FOR_ELIGIBILITY = 5;
const MIN_TOURNAMENT_ENTRIES = 1;

// ============================================
// EXCLUDED WALLETS/ACCOUNTS - Owner/Team
// These accounts are tracked but excluded from receiving rewards
// Their points are redistributed to other participants
// ============================================
const EXCLUDED_WALLETS = [
  '0x96e0b627454ce3b8c55c6d36b5fcbb13849dc297', // Owner wallet
];

const EXCLUDED_DISCORD_IDS = [
  '266737233967448066', // @EightBitDev
];

const EXCLUDED_TELEGRAM_IDS = [
  '@EightBitDev',
  'EightBitDev',
];

/**
 * Check if a wallet/account should be excluded from rewards
 */
function isExcludedFromRewards(
  wallet: string,
  discordId: string | null,
  telegramId: string | null
): boolean {
  const normalizedWallet = wallet.toLowerCase();

  // Check wallet exclusion
  if (EXCLUDED_WALLETS.includes(normalizedWallet)) {
    return true;
  }

  // Check Discord exclusion
  if (discordId && EXCLUDED_DISCORD_IDS.includes(discordId)) {
    return true;
  }

  // Check Telegram exclusion
  if (telegramId) {
    const normalizedTg = telegramId.replace('@', '').toLowerCase();
    if (EXCLUDED_TELEGRAM_IDS.some(id => id.replace('@', '').toLowerCase() === normalizedTg)) {
      return true;
    }
  }

  return false;
}

// Tier allocations (percentages)
const TIER_ALLOCATIONS = {
  legendary: { percent: 0.01, tokens: 2_000_000 },  // Top 1%
  epic: { percent: 0.05, tokens: 2_500_000 },       // Top 5% (excluding legendary)
  rare: { percent: 0.20, tokens: 3_500_000 },       // Top 20% (excluding epic)
  common: { percent: 1.00, tokens: 2_000_000 },     // Everyone else
};

interface PlayerScore {
  wallet: string;
  points: number;
  gamesPlayed: number;
  tournamentEntries: number;
  tournamentTop10Finishes: number;
  highScoreAchievements: number;
  isEarlyAdopter: boolean;
  firstActivityDate: Date | null;
  discordId: string | null;
  discordMessages: number;
  telegramId: string | null;
  telegramMessages: number;
  stakedAmount: number;
  highestLockTier: number;
  breakdown: {
    gamePoints: number;
    tournamentEntryPoints: number;
    tournamentFinishPoints: number;
    highScorePoints: number;
    discordPoints: number;
    telegramPoints: number;
    stakingPoints: number;
    multiplier: number;
  };
}

// Discord point thresholds (matches bot config)
const DISCORD_POINTS = {
  PLAYER_1: 5,        // Join server
  ARCADE_REGULAR: 25, // 50+ messages
  HIGH_SCORER: 50,    // 200+ messages
  LEADERBOARD_LEGEND: 100, // 500+ messages
};

// Telegram point thresholds (matches bot config)
const TELEGRAM_POINTS = {
  LINKED: 5,          // Linked wallet
  ACTIVE_50: 25,      // 50+ messages
  ACTIVE_200: 50,     // 200+ messages
  ACTIVE_500: 100,    // 500+ messages
};

// Staking point thresholds — incentivizes both amount and lock duration
// Amount points (based on total raw stake)
const STAKING_AMOUNT_POINTS = {
  ANY: 10,             // Any active stake
  STAKE_10K: 25,       // 10,000+ tokens staked
  STAKE_100K: 50,      // 100,000+ tokens staked
  STAKE_500K: 100,     // 500,000+ tokens staked
  STAKE_1M: 150,       // 1,000,000+ tokens staked
};

// Lock duration bonus (based on longest active lock tier)
// LockTier enum: 0=7days, 1=1month, 2=3months, 3=6months
const STAKING_LOCK_BONUS = {
  DAYS_7: 0,           // 7-day lock: no bonus
  MONTH_1: 15,         // 1-month lock: +15
  MONTHS_3: 30,        // 3-month lock: +30
  MONTHS_6: 50,        // 6-month lock: +50
};

// TieredStaking contract ABI (read-only for airdrop calculation)
const TIERED_STAKING_ABI = [
  'function userTotalStaked(address) view returns (uint256)',
  'function userStakeCount(address) view returns (uint256)',
  'function userStakes(address, uint256) view returns (uint256 amount, uint256 weightedAmount, uint256 rewardPerTokenPaid, uint256 pendingRewards, uint256 stakedAt, uint256 unlockTime, uint8 tier, bool exists)',
];

/**
 * Get staking contract instance (read-only, no signer needed)
 */
function getStakingContract(): ethers.Contract | null {
  if (!STAKING_ADDRESS) return null;
  try {
    const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
    return new ethers.Contract(STAKING_ADDRESS, TIERED_STAKING_ABI, provider);
  } catch (err) {
    console.error('Failed to create staking contract:', err);
    return null;
  }
}

/**
 * Calculate staking points for a wallet
 */
async function calculateStakingPoints(
  stakingContract: ethers.Contract,
  wallet: string
): Promise<{ stakedAmount: number; highestLockTier: number; stakingPoints: number }> {
  try {
    const totalStakedWei = await stakingContract.userTotalStaked(wallet);
    const stakedAmount = Math.floor(Number(ethers.formatEther(totalStakedWei)));

    if (stakedAmount === 0) {
      return { stakedAmount: 0, highestLockTier: -1, stakingPoints: 0 };
    }

    // Calculate amount points
    let amountPoints = STAKING_AMOUNT_POINTS.ANY;
    if (stakedAmount >= 1_000_000) {
      amountPoints = STAKING_AMOUNT_POINTS.STAKE_1M;
    } else if (stakedAmount >= 500_000) {
      amountPoints = STAKING_AMOUNT_POINTS.STAKE_500K;
    } else if (stakedAmount >= 100_000) {
      amountPoints = STAKING_AMOUNT_POINTS.STAKE_100K;
    } else if (stakedAmount >= 10_000) {
      amountPoints = STAKING_AMOUNT_POINTS.STAKE_10K;
    }

    // Find highest lock tier from active stakes
    let highestLockTier = 0;
    try {
      const stakeCount = Number(await stakingContract.userStakeCount(wallet));
      for (let i = 0; i < stakeCount; i++) {
        const stake = await stakingContract.userStakes(wallet, i);
        if (stake.exists && stake.amount > 0) {
          const tier = Number(stake.tier);
          if (tier > highestLockTier) highestLockTier = tier;
        }
      }
    } catch {
      // If individual stake reads fail, default to tier 0
    }

    // Calculate lock bonus
    let lockBonus = STAKING_LOCK_BONUS.DAYS_7;
    if (highestLockTier >= 3) lockBonus = STAKING_LOCK_BONUS.MONTHS_6;
    else if (highestLockTier >= 2) lockBonus = STAKING_LOCK_BONUS.MONTHS_3;
    else if (highestLockTier >= 1) lockBonus = STAKING_LOCK_BONUS.MONTH_1;

    return {
      stakedAmount,
      highestLockTier,
      stakingPoints: amountPoints + lockBonus,
    };
  } catch (err) {
    console.error(`   Error reading staking for ${wallet}:`, err);
    return { stakedAmount: 0, highestLockTier: -1, stakingPoints: 0 };
  }
}

interface AirdropAllocation {
  wallet: string;
  points: number;
  tier: 'legendary' | 'epic' | 'rare' | 'common';
  tokenAmount: string; // In wei (18 decimals)
  tokenAmountFormatted: number; // Human readable
  rank: number;
}

interface MerkleTreeData {
  root: string;
  proofs: { [wallet: string]: string[] };
  allocations: AirdropAllocation[];
}

/**
 * Helper: Calculate points - NO CAPS
 * Each game = 1 point, no diminishing returns
 * Users who play more get more points proportionally
 */
function calculateGamePoints(gamesPlayed: number): number {
  // Direct 1:1 - every game counts, no caps
  return gamesPlayed;
}

/**
 * Calculate high score achievement points
 */
function calculateHighScorePoints(rank: number): number {
  if (rank === 1) return 50;
  if (rank <= 3) return 40;
  if (rank <= 10) return 30;
  if (rank <= 25) return 20;
  if (rank <= 50) return 10;
  if (rank <= 100) return 5;
  return 0;
}

/**
 * Main calculation function - aggregates all player data
 */
async function calculatePlayerScores(): Promise<PlayerScore[]> {
  console.log('🎮 Starting airdrop score calculation...');

  const playerScores: Map<string, PlayerScore> = new Map();
  const earlyAdopters: Set<string> = new Set();

  // Initialize helper function
  const getOrCreatePlayer = (wallet: string): PlayerScore => {
    const normalizedWallet = wallet.toLowerCase();
    if (!playerScores.has(normalizedWallet)) {
      playerScores.set(normalizedWallet, {
        wallet: normalizedWallet,
        points: 0,
        gamesPlayed: 0,
        tournamentEntries: 0,
        tournamentTop10Finishes: 0,
        highScoreAchievements: 0,
        isEarlyAdopter: false,
        firstActivityDate: null,
        discordId: null,
        discordMessages: 0,
        telegramId: null,
        telegramMessages: 0,
        stakedAmount: 0,
        highestLockTier: -1,
        breakdown: {
          gamePoints: 0,
          tournamentEntryPoints: 0,
          tournamentFinishPoints: 0,
          highScorePoints: 0,
          discordPoints: 0,
          telegramPoints: 0,
          stakingPoints: 0,
          multiplier: 1,
        },
      });
    }
    return playerScores.get(normalizedWallet)!;
  };

  // ============================================
  // 1. Count games played from sessions collection
  // ============================================
  console.log('📊 Counting games played...');
  const sessionsSnapshot = await db.collection('sessions')
    .where('completedAt', '!=', null)
    .get();

  console.log(`   Found ${sessionsSnapshot.size} completed game sessions`);

  // Track first activity dates for early adopter bonus
  const firstActivityDates: Map<string, Date> = new Map();

  for (const doc of sessionsSnapshot.docs) {
    const data = doc.data();
    const wallet = data.player?.toLowerCase();
    if (!wallet) continue;

    const player = getOrCreatePlayer(wallet);
    player.gamesPlayed++;

    // Track first activity
    const sessionDate = data.completedAt?.toDate();
    if (sessionDate) {
      if (!firstActivityDates.has(wallet) || sessionDate < firstActivityDates.get(wallet)!) {
        firstActivityDates.set(wallet, sessionDate);
      }
    }
  }

  // Determine early adopters (first 100 unique players by first activity date)
  const sortedByDate = Array.from(firstActivityDates.entries())
    .sort((a, b) => a[1].getTime() - b[1].getTime())
    .slice(0, 100);

  for (const [wallet] of sortedByDate) {
    earlyAdopters.add(wallet);
    const player = getOrCreatePlayer(wallet);
    player.isEarlyAdopter = true;
    player.firstActivityDate = firstActivityDates.get(wallet) || null;
  }

  console.log(`   Identified ${earlyAdopters.size} early adopters`);

  // ============================================
  // 2. Count tournament entries and finishes
  // ============================================
  console.log('🏆 Counting tournament participation...');
  const tournamentsSnapshot = await db.collection('tournaments').get();

  console.log(`   Found ${tournamentsSnapshot.size} tournaments`);

  for (const tournamentDoc of tournamentsSnapshot.docs) {
    const tournamentId = tournamentDoc.id;
    const tournamentData = tournamentDoc.data();

    // Get all entries for this tournament
    const entriesSnapshot = await db.collection('tournaments')
      .doc(tournamentId)
      .collection('entries')
      .get();

    console.log(`   Tournament ${tournamentId}: ${entriesSnapshot.size} entries`);

    // Sort entries by score to determine rankings
    const entries = entriesSnapshot.docs.map(doc => ({
      wallet: doc.id.toLowerCase(),
      score: doc.data().bestScore || doc.data().totalScore || 0,
    })).sort((a, b) => b.score - a.score);

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const player = getOrCreatePlayer(entry.wallet);
      player.tournamentEntries++;

      // Check for top 10 finish (only for completed tournaments)
      if (tournamentData.status === 'completed' && i < 10 && entry.score > 0) {
        player.tournamentTop10Finishes++;
      }
    }
  }

  // ============================================
  // 3. Calculate high score achievements from leaderboards
  // ============================================
  console.log('🎯 Calculating high score achievements...');
  const leaderboardsSnapshot = await db.collection('leaderboards').get();

  console.log(`   Found ${leaderboardsSnapshot.size} game leaderboards`);

  for (const leaderboardDoc of leaderboardsSnapshot.docs) {
    const data = leaderboardDoc.data();
    const allTimeEntries = data.allTime || [];

    // Award points based on ranking
    for (let i = 0; i < Math.min(allTimeEntries.length, 100); i++) {
      const entry = allTimeEntries[i];
      const wallet = entry.odedId?.toLowerCase();
      if (!wallet) continue;

      const player = getOrCreatePlayer(wallet);
      const rankPoints = calculateHighScorePoints(i + 1);
      if (rankPoints > 0) {
        player.highScoreAchievements++;
        player.breakdown.highScorePoints += rankPoints;
      }
    }
  }

  // ============================================
  // 4. Also check scores collection for additional data
  // ============================================
  console.log('📈 Checking scores collection...');
  const scoresSnapshot = await db.collection('scores').get();

  console.log(`   Found ${scoresSnapshot.size} player score records`);

  for (const scoreDoc of scoresSnapshot.docs) {
    const wallet = scoreDoc.id.toLowerCase();
    const data = scoreDoc.data();
    const player = getOrCreatePlayer(wallet);

    // Cross-reference total games played
    const totalGames = data.totalGames || 0;
    if (totalGames > player.gamesPlayed) {
      console.log(`   Adjusting games for ${wallet}: ${player.gamesPlayed} -> ${totalGames}`);
      player.gamesPlayed = totalGames;
    }
  }

  // ============================================
  // 5. Fetch Discord activity (linked wallets only)
  // ============================================
  console.log('💬 Fetching Discord activity...');

  // Get all Discord-wallet links
  const discordLinksSnapshot = await db.collection('discord_links').get();
  console.log(`   Found ${discordLinksSnapshot.size} Discord-wallet links`);

  // Create map of wallet -> discordId
  const walletToDiscord: Map<string, string> = new Map();
  for (const doc of discordLinksSnapshot.docs) {
    const data = doc.data();
    if (data.walletAddress) {
      walletToDiscord.set(data.walletAddress.toLowerCase(), doc.id);
    }
  }

  // Get all Discord activity
  const discordActivitySnapshot = await db.collection('discord_activity').get();
  console.log(`   Found ${discordActivitySnapshot.size} Discord activity records`);

  // Create map of discordId -> messageCount
  const discordActivity: Map<string, number> = new Map();
  for (const doc of discordActivitySnapshot.docs) {
    const data = doc.data();
    discordActivity.set(doc.id, data.messageCount || 0);
  }

  // Apply Discord points to linked wallets
  for (const [wallet, discordId] of walletToDiscord) {
    const messageCount = discordActivity.get(discordId) || 0;

    if (messageCount > 0) {
      const player = getOrCreatePlayer(wallet);
      player.discordId = discordId;
      player.discordMessages = messageCount;

      // Calculate Discord points based on message thresholds
      let discordPoints = DISCORD_POINTS.PLAYER_1; // Base points for linking

      if (messageCount >= 500) {
        discordPoints += DISCORD_POINTS.LEADERBOARD_LEGEND;
      } else if (messageCount >= 200) {
        discordPoints += DISCORD_POINTS.HIGH_SCORER;
      } else if (messageCount >= 50) {
        discordPoints += DISCORD_POINTS.ARCADE_REGULAR;
      }

      player.breakdown.discordPoints = discordPoints;
      console.log(`   ${wallet.slice(0, 10)}... linked to Discord: ${messageCount} messages = ${discordPoints} pts`);
    }
  }

  // ============================================
  // 5b. Fetch Telegram activity (linked wallets only)
  // ============================================
  console.log('📱 Fetching Telegram activity...');

  // Get all Telegram-wallet links
  const telegramLinksSnapshot = await db.collection('telegram_links').get();
  console.log(`   Found ${telegramLinksSnapshot.size} Telegram-wallet links`);

  // Create map of wallet -> telegramId
  const walletToTelegram: Map<string, string> = new Map();
  for (const doc of telegramLinksSnapshot.docs) {
    const data = doc.data();
    if (data.walletAddress) {
      walletToTelegram.set(data.walletAddress.toLowerCase(), doc.id);
    }
  }

  // Get all Telegram activity
  const telegramActivitySnapshot = await db.collection('telegram_activity').get();
  console.log(`   Found ${telegramActivitySnapshot.size} Telegram activity records`);

  // Create map of telegramId -> messageCount
  const telegramActivity: Map<string, number> = new Map();
  for (const doc of telegramActivitySnapshot.docs) {
    const data = doc.data();
    telegramActivity.set(doc.id, data.messageCount || 0);
  }

  // Apply Telegram points to linked wallets
  for (const [wallet, telegramId] of walletToTelegram) {
    const messageCount = telegramActivity.get(telegramId) || 0;

    if (messageCount > 0) {
      const player = getOrCreatePlayer(wallet);
      player.telegramId = telegramId;
      player.telegramMessages = messageCount;

      // Calculate Telegram points based on message thresholds
      let telegramPoints = TELEGRAM_POINTS.LINKED; // Base points for linking

      if (messageCount >= 500) {
        telegramPoints += TELEGRAM_POINTS.ACTIVE_500;
      } else if (messageCount >= 200) {
        telegramPoints += TELEGRAM_POINTS.ACTIVE_200;
      } else if (messageCount >= 50) {
        telegramPoints += TELEGRAM_POINTS.ACTIVE_50;
      }

      player.breakdown.telegramPoints = telegramPoints;
      console.log(`   ${wallet.slice(0, 10)}... linked to Telegram: ${messageCount} messages = ${telegramPoints} pts`);
    }
  }

  // ============================================
  // 5c. Fetch on-chain staking data
  // ============================================
  console.log('🥩 Fetching staking data from chain...');

  const stakingContract = getStakingContract();
  if (stakingContract) {
    const wallets = Array.from(playerScores.keys());
    let stakersFound = 0;

    for (const wallet of wallets) {
      const { stakedAmount, highestLockTier, stakingPoints } =
        await calculateStakingPoints(stakingContract, wallet);

      if (stakedAmount > 0) {
        const player = playerScores.get(wallet)!;
        player.stakedAmount = stakedAmount;
        player.highestLockTier = highestLockTier;
        player.breakdown.stakingPoints = stakingPoints;
        stakersFound++;
        console.log(`   ${wallet.slice(0, 10)}... staked ${stakedAmount.toLocaleString()} (tier ${highestLockTier}) = ${stakingPoints} pts`);
      }
    }

    console.log(`   Found ${stakersFound} stakers out of ${wallets.length} players`);
  } else {
    console.log('   ⚠️ Staking contract not available, skipping');
  }

  // ============================================
  // 6. Calculate final points for each player
  // ============================================
  console.log('🧮 Calculating final scores...');

  for (const player of playerScores.values()) {
    // Game points with diminishing returns
    player.breakdown.gamePoints = calculateGamePoints(player.gamesPlayed);

    // Tournament entry points (25 each)
    player.breakdown.tournamentEntryPoints = player.tournamentEntries * 25;

    // Tournament top 10 finish points (100 each)
    player.breakdown.tournamentFinishPoints = player.tournamentTop10Finishes * 100;

    // High score points already calculated

    // Early adopter multiplier
    player.breakdown.multiplier = player.isEarlyAdopter ? 2.0 : 1.0;

    // Calculate total points (including Discord + Telegram + Staking)
    const basePoints =
      player.breakdown.gamePoints +
      player.breakdown.tournamentEntryPoints +
      player.breakdown.tournamentFinishPoints +
      player.breakdown.highScorePoints +
      player.breakdown.discordPoints +
      player.breakdown.telegramPoints +
      player.breakdown.stakingPoints;

    player.points = Math.floor(basePoints * player.breakdown.multiplier);
  }

  // Convert to array and sort by points
  const sortedPlayers = Array.from(playerScores.values())
    .sort((a, b) => b.points - a.points);

  console.log(`✅ Calculated scores for ${sortedPlayers.length} players`);
  console.log(`   Top 5 players:`);
  sortedPlayers.slice(0, 5).forEach((p, i) => {
    console.log(`   ${i + 1}. ${p.wallet.slice(0, 10)}... - ${p.points} points (${p.gamesPlayed} games, ${p.tournamentEntries} tournaments)`);
  });

  return sortedPlayers;
}

/**
 * Calculate breadth bonus - rewards users who participate in multiple ways
 * Using more methods = higher multiplier on their base points
 */
function calculateBreadthBonus(player: PlayerScore): number {
  let methodsUsed = 0;

  // Count distinct participation methods
  if (player.gamesPlayed > 0) methodsUsed++;           // Gaming
  if (player.tournamentEntries > 0) methodsUsed++;     // Tournaments
  if (player.highScoreAchievements > 0) methodsUsed++; // High scores
  if (player.discordId && player.discordMessages > 0) methodsUsed++;  // Discord
  if (player.telegramId && player.telegramMessages > 0) methodsUsed++; // Telegram
  if (player.stakedAmount > 0) methodsUsed++;          // Staking

  // Breadth multiplier: using all 6 methods = 2x bonus
  // 1 method = 1x, 2 methods = 1.2x, 3 = 1.4x, 4 = 1.6x, 5 = 1.8x, 6 = 2x
  return 1 + ((methodsUsed - 1) * 0.2);
}

/**
 * Filter eligible players and calculate allocations
 * NEW: Proportional distribution based on total points, no caps
 * Users who use all methods get breadth bonus
 * Excluded wallets (owner/team) don't receive tokens
 */
function calculateAllocations(players: PlayerScore[]): AirdropAllocation[] {
  console.log('💰 Calculating token allocations (proportional, no caps)...');

  // Filter for eligible players (includes Discord + Telegram + Staking)
  const MIN_DISCORD_MESSAGES = 50;
  const MIN_TELEGRAM_MESSAGES = 50;

  const eligible = players.filter(p =>
    p.gamesPlayed >= MIN_GAMES_FOR_ELIGIBILITY ||
    p.tournamentEntries >= MIN_TOURNAMENT_ENTRIES ||
    (p.discordId && p.discordMessages >= MIN_DISCORD_MESSAGES) ||
    (p.telegramId && p.telegramMessages >= MIN_TELEGRAM_MESSAGES) ||
    p.stakedAmount > 0
  );

  console.log(`   ${eligible.length} players eligible (of ${players.length} total)`);

  // Separate excluded accounts from reward recipients
  const excluded: PlayerScore[] = [];
  const recipients: PlayerScore[] = [];

  for (const player of eligible) {
    if (isExcludedFromRewards(player.wallet, player.discordId, player.telegramId)) {
      excluded.push(player);
      console.log(`   ⚠️ Excluded from rewards: ${player.wallet.slice(0, 10)}... (${player.points} points - redistributed)`);
    } else {
      recipients.push(player);
    }
  }

  console.log(`   ${recipients.length} reward recipients, ${excluded.length} excluded accounts`);

  if (recipients.length === 0) {
    console.log('   ⚠️ No reward recipients found!');
    return [];
  }

  // Calculate weighted points with breadth bonus for all recipients
  const recipientWeights = recipients.map(player => {
    const breadthMultiplier = calculateBreadthBonus(player);
    const weightedPoints = Math.floor(player.points * breadthMultiplier);
    return {
      player,
      breadthMultiplier,
      weightedPoints,
    };
  });

  // Total weighted points across all recipients
  const totalWeightedPoints = recipientWeights.reduce((sum, r) => sum + r.weightedPoints, 0);

  console.log(`   Total weighted points: ${totalWeightedPoints.toLocaleString()}`);
  console.log(`   Distributing ${TOTAL_AIRDROP_TOKENS.toLocaleString()} tokens proportionally`);

  // Assign allocations based purely on weighted points (proportional)
  const allocations: AirdropAllocation[] = [];

  // Sort by weighted points descending for ranking
  recipientWeights.sort((a, b) => b.weightedPoints - a.weightedPoints);

  for (let i = 0; i < recipientWeights.length; i++) {
    const { player, weightedPoints, breadthMultiplier } = recipientWeights[i];

    // Calculate proportional share of the pool
    const shareOfPool = totalWeightedPoints > 0 ? weightedPoints / totalWeightedPoints : 1 / recipients.length;
    const tokenAmount = Math.floor(TOTAL_AIRDROP_TOKENS * shareOfPool);

    // Determine tier label based on relative position (for display only)
    let tier: 'legendary' | 'epic' | 'rare' | 'common';
    const percentile = (i + 1) / recipientWeights.length;
    if (percentile <= 0.01) {
      tier = 'legendary';
    } else if (percentile <= 0.05) {
      tier = 'epic';
    } else if (percentile <= 0.20) {
      tier = 'rare';
    } else {
      tier = 'common';
    }

    // Convert to wei (18 decimals)
    const tokenAmountWei = BigInt(tokenAmount) * BigInt(10 ** TOKENS_DECIMALS);

    allocations.push({
      wallet: player.wallet,
      points: weightedPoints, // Store weighted points for transparency
      tier,
      tokenAmount: tokenAmountWei.toString(),
      tokenAmountFormatted: tokenAmount,
      rank: i + 1,
    });

    // Log top performers with breadth bonus
    if (i < 10) {
      console.log(`   #${i + 1} ${player.wallet.slice(0, 10)}... - ${player.points} pts x${breadthMultiplier.toFixed(1)} = ${weightedPoints} weighted → ${tokenAmount.toLocaleString()} tokens`);
    }
  }

  // Verify total allocation
  const totalAllocated = allocations.reduce((sum, a) => sum + a.tokenAmountFormatted, 0);
  console.log(`   Total allocated: ${totalAllocated.toLocaleString()} tokens`);
  console.log(`   Tier distribution (by rank):`);
  console.log(`   - Legendary: ${allocations.filter(a => a.tier === 'legendary').length} users`);
  console.log(`   - Epic: ${allocations.filter(a => a.tier === 'epic').length} users`);
  console.log(`   - Rare: ${allocations.filter(a => a.tier === 'rare').length} users`);
  console.log(`   - Common: ${allocations.filter(a => a.tier === 'common').length} users`);

  return allocations;
}

/**
 * Generate Merkle tree from allocations
 */
function generateMerkleTree(allocations: AirdropAllocation[]): MerkleTreeData {
  console.log('🌳 Generating Merkle tree...');

  if (allocations.length === 0) {
    return { root: '0x', proofs: {}, allocations: [] };
  }

  // Create leaf nodes: keccak256(abi.encodePacked(wallet, amount))
  const leaves = allocations.map(a => {
    const packed = encodePacked(
      ['address', 'uint256'],
      [a.wallet as `0x${string}`, BigInt(a.tokenAmount)]
    );
    return keccak256(packed);
  });

  console.log(`   Created ${leaves.length} leaf nodes`);

  // Build tree layers
  const layers: string[][] = [leaves];

  while (layers[layers.length - 1].length > 1) {
    const currentLayer = layers[layers.length - 1];
    const nextLayer: string[] = [];

    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = currentLayer[i + 1] || left; // Duplicate last node if odd

      // Sort to ensure consistent ordering
      const [first, second] = left < right ? [left, right] : [right, left];
      const combined = keccak256(encodePacked(['bytes32', 'bytes32'], [first as `0x${string}`, second as `0x${string}`]));
      nextLayer.push(combined);
    }

    layers.push(nextLayer);
  }

  const root = layers[layers.length - 1][0];
  console.log(`   Merkle root: ${root}`);

  // Generate proofs for each allocation
  const proofs: { [wallet: string]: string[] } = {};

  for (let i = 0; i < allocations.length; i++) {
    const proof: string[] = [];
    let index = i;

    for (let layer = 0; layer < layers.length - 1; layer++) {
      const currentLayer = layers[layer];
      const isRight = index % 2 === 1;
      const siblingIndex = isRight ? index - 1 : index + 1;

      if (siblingIndex < currentLayer.length) {
        proof.push(currentLayer[siblingIndex]);
      } else if (siblingIndex === currentLayer.length) {
        // Odd number of nodes, sibling is self
        proof.push(currentLayer[index]);
      }

      index = Math.floor(index / 2);
    }

    proofs[allocations[i].wallet] = proof;
  }

  console.log(`   Generated ${Object.keys(proofs).length} proofs`);

  return { root, proofs, allocations };
}

/**
 * ADMIN ONLY: Trigger airdrop snapshot
 * This calculates all player scores and generates the Merkle tree
 */
export const triggerAirdropSnapshot = onCall(async (request) => {
  // Verify admin (you'd want to add proper admin verification here)
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  // For security, limit to specific admin addresses
  const adminAddresses: string[] = [
    // Add your admin wallet addresses here
  ];

  const callerAddress = request.auth.uid.toLowerCase();

  // If admin list is empty, allow anyone (for testing)
  if (adminAddresses.length > 0 && !adminAddresses.includes(callerAddress)) {
    throw new HttpsError('permission-denied', 'Only admins can trigger airdrop snapshot');
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('  🚀 AIRDROP SNAPSHOT TRIGGERED');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Triggered by: ${callerAddress}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log();

  try {
    // Step 1: Calculate all player scores
    const playerScores = await calculatePlayerScores();

    // Step 2: Calculate token allocations
    const allocations = calculateAllocations(playerScores);

    // Step 3: Generate Merkle tree
    const merkleData = generateMerkleTree(allocations);

    // Step 4: Store snapshot in Firestore
    const snapshotId = `airdrop_${Date.now()}`;
    const claimDeadline = new Date();
    claimDeadline.setDate(claimDeadline.getDate() + 90); // 90 days to claim

    await db.collection('airdrops').doc(snapshotId).set({
      merkleRoot: merkleData.root,
      totalTokens: TOTAL_AIRDROP_TOKENS,
      totalRecipients: allocations.length,
      createdAt: Timestamp.now(),
      createdBy: callerAddress,
      claimDeadline: Timestamp.fromDate(claimDeadline),
      status: 'pending_deployment', // Will be 'active' after contract deployment
      vestingSchedule: {
        immediate: 33.33,
        month1: 33.33,
        month2: 33.34,
      },
      tierStats: {
        legendary: allocations.filter(a => a.tier === 'legendary').length,
        epic: allocations.filter(a => a.tier === 'epic').length,
        rare: allocations.filter(a => a.tier === 'rare').length,
        common: allocations.filter(a => a.tier === 'common').length,
      },
    });

    // Store individual allocations (for claim page lookup)
    const batch = db.batch();
    for (const allocation of allocations) {
      const allocRef = db.collection('airdrops').doc(snapshotId).collection('allocations').doc(allocation.wallet);
      batch.set(allocRef, {
        wallet: allocation.wallet,
        points: allocation.points,
        tier: allocation.tier,
        tokenAmount: allocation.tokenAmount,
        tokenAmountFormatted: allocation.tokenAmountFormatted,
        rank: allocation.rank,
        proof: merkleData.proofs[allocation.wallet],
        claimed: false,
        claimedAt: null,
      });
    }
    await batch.commit();

    // Store player details for debugging
    const detailsBatch = db.batch();
    for (const player of playerScores.slice(0, 500)) { // Store top 500 for debugging
      const detailRef = db.collection('airdrops').doc(snapshotId).collection('playerDetails').doc(player.wallet);
      detailsBatch.set(detailRef, {
        wallet: player.wallet,
        points: player.points,
        gamesPlayed: player.gamesPlayed,
        tournamentEntries: player.tournamentEntries,
        tournamentTop10Finishes: player.tournamentTop10Finishes,
        highScoreAchievements: player.highScoreAchievements,
        isEarlyAdopter: player.isEarlyAdopter,
        discordId: player.discordId,
        discordMessages: player.discordMessages,
        breakdown: player.breakdown,
      });
    }
    await detailsBatch.commit();

    console.log();
    console.log('═══════════════════════════════════════════════════');
    console.log('  ✅ AIRDROP SNAPSHOT COMPLETE');
    console.log('═══════════════════════════════════════════════════');
    console.log(`Snapshot ID: ${snapshotId}`);
    console.log(`Merkle Root: ${merkleData.root}`);
    console.log(`Total Recipients: ${allocations.length}`);
    console.log(`Total Tokens: ${TOTAL_AIRDROP_TOKENS.toLocaleString()}`);
    console.log(`Claim Deadline: ${claimDeadline.toISOString()}`);
    console.log();

    return {
      success: true,
      snapshotId,
      merkleRoot: merkleData.root,
      totalRecipients: allocations.length,
      totalTokens: TOTAL_AIRDROP_TOKENS,
      claimDeadline: claimDeadline.toISOString(),
      tierStats: {
        legendary: allocations.filter(a => a.tier === 'legendary').length,
        epic: allocations.filter(a => a.tier === 'epic').length,
        rare: allocations.filter(a => a.tier === 'rare').length,
        common: allocations.filter(a => a.tier === 'common').length,
      },
    };
  } catch (error) {
    console.error('❌ Airdrop snapshot failed:', error);
    throw new HttpsError('internal', `Airdrop snapshot failed: ${error}`);
  }
});

/**
 * Calculate real-time eligibility for a wallet based on actual Firestore data
 * This fetches live data from games, tournaments, Discord, and Zealy
 */
async function calculateRealTimeEligibility(wallet: string) {
  console.log(`📊 Calculating real-time eligibility for ${wallet}`);
  const normalizedWallet = wallet.toLowerCase();

  // Initialize stats
  let gamesPlayed = 0;
  let tournamentEntries = 0;
  let tournamentTop10Finishes = 0;
  let highScoreAchievements = 0;
  let highScorePoints = 0;
  let discordMessages = 0;
  let discordPoints = 0;
  let zealyXP = 0;
  let zealyQuests = 0;
  let telegramMessages = 0;
  let telegramPoints = 0;
  let isEarlyAdopter = false;

  // 1. Get games played from users collection (primary source)
  const userDoc = await db.collection('users').doc(normalizedWallet).get();
  if (userDoc.exists) {
    const userData = userDoc.data();
    gamesPlayed = userData?.totalGamesPlayed || 0;
    console.log(`   Users collection: totalGamesPlayed = ${gamesPlayed}`);
    // Check if early adopter (user created in first month or first 100 users)
    const createdAt = userData?.createdAt?.toDate?.();
    if (createdAt) {
      const earlyDate = new Date('2024-06-01'); // Adjust based on actual launch date
      isEarlyAdopter = createdAt < earlyDate;
    }
  } else {
    console.log(`   Users collection: No document found for ${normalizedWallet}`);
  }

  // 2. Also check scores collection for game count (backup source)
  const scoresDoc = await db.collection('scores').doc(normalizedWallet).get();
  if (scoresDoc.exists) {
    const scoresData = scoresDoc.data();
    const scoresTotalGames = scoresData?.totalGames || 0;
    console.log(`   Scores collection: totalGames = ${scoresTotalGames}`);
    if (scoresTotalGames > gamesPlayed) {
      gamesPlayed = scoresTotalGames;
    }
  }

  // 3. Get tournament entries and finishes
  try {
    const tournamentsSnapshot = await db.collection('tournaments').get();
    console.log(`   Found ${tournamentsSnapshot.size} tournaments to check`);

    for (const tournamentDoc of tournamentsSnapshot.docs) {
      const entryDoc = await db.collection('tournaments')
        .doc(tournamentDoc.id)
        .collection('entries')
        .doc(normalizedWallet)
        .get();

      if (entryDoc.exists) {
        tournamentEntries++;
        console.log(`   Found entry in tournament ${tournamentDoc.id}`);

        // Check for top 10 finish in completed tournaments
        const tournamentData = tournamentDoc.data();
        if (tournamentData.status === 'completed') {
          const allEntries = await db.collection('tournaments')
            .doc(tournamentDoc.id)
            .collection('entries')
            .orderBy('bestScore', 'desc')
            .limit(10)
            .get();

          const top10Wallets = allEntries.docs.map(d => d.id.toLowerCase());
          if (top10Wallets.includes(normalizedWallet)) {
            tournamentTop10Finishes++;
          }
        }
      }
    }
  } catch (err) {
    console.error('   Error checking tournaments:', err);
  }

  // 4. Get high score achievements from leaderboards
  try {
    const leaderboardsSnapshot = await db.collection('leaderboards').get();
    console.log(`   Found ${leaderboardsSnapshot.size} leaderboards to check`);

    for (const leaderboardDoc of leaderboardsSnapshot.docs) {
      const data = leaderboardDoc.data();
      const allTimeEntries = data.allTime || [];

      for (let i = 0; i < Math.min(allTimeEntries.length, 100); i++) {
        const entry = allTimeEntries[i];
        // Check both odedId and odedId fields (case insensitive)
        const entryWallet = (entry.odedId || entry.playerId || entry.wallet || '').toLowerCase();
        if (entryWallet === normalizedWallet) {
          highScoreAchievements++;
          highScorePoints += calculateHighScorePoints(i + 1);
          console.log(`   Found in ${leaderboardDoc.id} leaderboard at rank ${i + 1}`);
          break; // Only count once per game
        }
      }
    }
  } catch (err) {
    console.error('   Error checking leaderboards:', err);
  }

  // 5. Get Discord activity
  try {
    const discordLinkDoc = await db.collection('discord_links')
      .where('walletAddress', '==', normalizedWallet)
      .limit(1)
      .get();

    if (!discordLinkDoc.empty) {
      const discordId = discordLinkDoc.docs[0].id;
      console.log(`   Found Discord link: ${discordId}`);
      const discordActivityDoc = await db.collection('discord_activity').doc(discordId).get();

      if (discordActivityDoc.exists) {
        discordMessages = discordActivityDoc.data()?.messageCount || 0;
        console.log(`   Discord messages: ${discordMessages}`);

        // Calculate Discord points
        discordPoints = DISCORD_POINTS.PLAYER_1; // Base points for linking
        if (discordMessages >= 500) {
          discordPoints += DISCORD_POINTS.LEADERBOARD_LEGEND;
        } else if (discordMessages >= 200) {
          discordPoints += DISCORD_POINTS.HIGH_SCORER;
        } else if (discordMessages >= 50) {
          discordPoints += DISCORD_POINTS.ARCADE_REGULAR;
        }
      }
    } else {
      console.log(`   No Discord link found for wallet`);
    }
  } catch (err) {
    console.error('   Error checking Discord:', err);
  }

  // 6. Get Zealy data
  try {
    const zealyDoc = await db.collection('zealy_users').doc(normalizedWallet).get();
    if (zealyDoc.exists) {
      const zealyData = zealyDoc.data();
      zealyXP = zealyData?.xp || 0;
      zealyQuests = zealyData?.questsCompleted || 0;
      console.log(`   Zealy XP: ${zealyXP}, Quests: ${zealyQuests}`);
    }
  } catch (err) {
    console.error('   Error checking Zealy:', err);
  }

  // 7. Get Telegram activity (query telegram_links → telegram_activity for live data)
  try {
    const telegramLinkDoc = await db.collection('telegram_links')
      .where('walletAddress', '==', normalizedWallet)
      .limit(1)
      .get();

    if (!telegramLinkDoc.empty) {
      const telegramId = telegramLinkDoc.docs[0].id;
      console.log(`   Found Telegram link: ${telegramId}`);
      const telegramActivityDoc = await db.collection('telegram_activity').doc(telegramId).get();

      if (telegramActivityDoc.exists) {
        telegramMessages = telegramActivityDoc.data()?.messageCount || 0;
        console.log(`   Telegram messages: ${telegramMessages}`);

        // Calculate Telegram points
        telegramPoints = TELEGRAM_POINTS.LINKED; // Base points for linking
        if (telegramMessages >= 500) {
          telegramPoints += TELEGRAM_POINTS.ACTIVE_500;
        } else if (telegramMessages >= 200) {
          telegramPoints += TELEGRAM_POINTS.ACTIVE_200;
        } else if (telegramMessages >= 50) {
          telegramPoints += TELEGRAM_POINTS.ACTIVE_50;
        }
      } else {
        // Linked but no activity yet - still get base points
        telegramPoints = TELEGRAM_POINTS.LINKED;
        console.log(`   Telegram linked but no activity yet`);
      }
    } else {
      console.log(`   No Telegram link found for wallet`);
    }
  } catch (err) {
    console.error('   Error checking Telegram:', err);
  }

  // 8. Get on-chain staking data
  let stakedAmount = 0;
  let highestLockTier = -1;
  let stakingPoints = 0;
  try {
    const stakingContract = getStakingContract();
    if (stakingContract) {
      const result = await calculateStakingPoints(stakingContract, normalizedWallet);
      stakedAmount = result.stakedAmount;
      highestLockTier = result.highestLockTier;
      stakingPoints = result.stakingPoints;
      if (stakedAmount > 0) {
        console.log(`   Staked: ${stakedAmount.toLocaleString()} tokens, tier ${highestLockTier}, ${stakingPoints} pts`);
      } else {
        console.log(`   No active stake`);
      }
    }
  } catch (err) {
    console.error('   Error checking staking:', err);
  }

  // Calculate total points - NO CAPS
  const gamePoints = calculateGamePoints(gamesPlayed); // Direct 1:1, no cap
  const tournamentEntryPoints = tournamentEntries * 25;
  const tournamentFinishPoints = tournamentTop10Finishes * 100;
  const zealyPoints = zealyXP / 10; // NO CAP on Zealy either

  const earlyAdopterMultiplier = isEarlyAdopter ? 2.0 : 1.0;

  // Calculate breadth bonus - using more methods = more rewards
  let methodsUsed = 0;
  if (gamesPlayed > 0) methodsUsed++;
  if (tournamentEntries > 0) methodsUsed++;
  if (highScoreAchievements > 0) methodsUsed++;
  if (discordMessages > 0) methodsUsed++;
  if (telegramMessages > 0) methodsUsed++;
  if (stakedAmount > 0) methodsUsed++;

  // Breadth multiplier: 1 method = 1x, 6 methods = 2x
  const breadthMultiplier = 1 + ((methodsUsed - 1) * 0.2);

  const basePoints = gamePoints + tournamentEntryPoints + tournamentFinishPoints +
                     highScorePoints + discordPoints + zealyPoints + telegramPoints + stakingPoints;

  // Apply both early adopter and breadth multipliers
  const totalPoints = Math.floor(basePoints * earlyAdopterMultiplier);
  const weightedPoints = Math.floor(totalPoints * breadthMultiplier);

  // Check if this wallet is excluded from rewards (owner/team)
  let discordIdForCheck: string | null = null;
  let telegramIdForCheck: string | null = null;
  try {
    const discordLinkCheck = await db.collection('discord_links')
      .where('walletAddress', '==', normalizedWallet)
      .limit(1)
      .get();
    if (!discordLinkCheck.empty) {
      discordIdForCheck = discordLinkCheck.docs[0].id;
    }
    const telegramLinkCheck = await db.collection('telegram_links')
      .where('walletAddress', '==', normalizedWallet)
      .limit(1)
      .get();
    if (!telegramLinkCheck.empty) {
      telegramIdForCheck = telegramLinkCheck.docs[0].data()?.telegramUsername || telegramLinkCheck.docs[0].id;
    }
  } catch {
    // Ignore errors in exclusion check
  }

  const isExcluded = isExcludedFromRewards(normalizedWallet, discordIdForCheck, telegramIdForCheck);

  // Determine eligibility
  const isEligible = !isExcluded && (
    gamesPlayed >= MIN_GAMES_FOR_ELIGIBILITY ||
    tournamentEntries >= MIN_TOURNAMENT_ENTRIES ||
    discordMessages >= 50 ||
    telegramMessages >= 50 ||
    stakedAmount > 0
  );

  // Proportional distribution - tier is just for display, based on rank position
  // Estimate based on weighted points (higher = more tokens)
  let tier: 'legendary' | 'epic' | 'rare' | 'common';
  let estimatedTokens: number;

  // Proportional system: tokens based purely on weighted points share
  // Using a simple estimation: points directly translate to token share
  // With ~200 users and 10M tokens, rough estimate per weighted point
  const estimatedTotalWeightedPoints = 100000; // Rough estimate of total pool
  const shareOfPool = weightedPoints / estimatedTotalWeightedPoints;
  estimatedTokens = Math.floor(TOTAL_AIRDROP_TOKENS * Math.min(shareOfPool, 0.20)); // Cap at 20% of pool per user

  // Minimum allocation for eligible users
  if (isEligible && estimatedTokens < 1000) {
    estimatedTokens = 1000;
  }

  // Tier labels based on estimated token amount (for display only)
  if (estimatedTokens >= 500000) {
    tier = 'legendary';
  } else if (estimatedTokens >= 100000) {
    tier = 'epic';
  } else if (estimatedTokens >= 25000) {
    tier = 'rare';
  } else {
    tier = 'common';
  }

  const tokenAmount = (BigInt(estimatedTokens) * BigInt(10 ** 18)).toString();

  const claimDeadline = new Date();
  claimDeadline.setDate(claimDeadline.getDate() + 90);

  console.log(`✅ Real-time calculation complete for ${wallet}:`);
  console.log(`   Games: ${gamesPlayed}, Tournaments: ${tournamentEntries}, Discord: ${discordMessages}, Zealy XP: ${zealyXP}, Telegram: ${telegramMessages}`);
  console.log(`   Base Points: ${totalPoints}, Breadth Bonus: x${breadthMultiplier.toFixed(1)} (${methodsUsed} methods), Weighted: ${weightedPoints}`);
  console.log(`   Tier: ${tier}, Estimated Tokens: ${estimatedTokens.toLocaleString()}`);
  if (isExcluded) {
    console.log(`   ⚠️ EXCLUDED FROM REWARDS (owner/team account)`);
  }

  // Calculate user's rank by comparing against all other users
  let rank: number | null = null;
  try {
    const allUsersSnapshot = await db.collection('users')
      .where('totalGamesPlayed', '>', 0)
      .get();

    // Count how many users have more points
    let usersWithMorePoints = 0;
    for (const userDoc of allUsersSnapshot.docs) {
      const userData = userDoc.data();
      const userGames = userData.totalGamesPlayed || 0;
      const userPoints = calculateGamePoints(userGames);
      if (userPoints > totalPoints) {
        usersWithMorePoints++;
      }
    }
    rank = usersWithMorePoints + 1;
    console.log(`   Calculated rank: #${rank} out of ${allUsersSnapshot.size} users`);
  } catch (err) {
    console.error('   Error calculating rank:', err);
  }

  // Determine message based on eligibility and exclusion status
  let message: string;
  if (isExcluded) {
    message = 'This account is excluded from rewards (owner/team). Activity is tracked but no tokens will be allocated.';
  } else if (isEligible) {
    message = `Live preview based on your current activity. Using ${methodsUsed} methods gives you a ${breadthMultiplier.toFixed(1)}x breadth bonus! Final allocation determined at snapshot.`;
  } else {
    message = `Not yet eligible. Need ${MIN_GAMES_FOR_ELIGIBILITY} games or ${MIN_TOURNAMENT_ENTRIES} tournament entry.`;
  }

  return {
    eligible: isEligible,
    excluded: isExcluded,
    airdropId: 'realtime_preview',
    wallet: normalizedWallet,
    tier: isEligible ? tier : null,
    rank: rank, // Calculated by comparing against all users
    points: totalPoints,
    weightedPoints: weightedPoints, // Points after breadth bonus
    tokenAmount: isEligible ? tokenAmount : '0',
    tokenAmountFormatted: isEligible ? estimatedTokens : 0,
    proof: [], // No proof until official snapshot
    claimed: false,
    claimedAt: null,
    claimDeadline: claimDeadline.toISOString(),
    merkleRoot: null,
    contractAddress: null,
    status: 'preview',
    message,
    vesting: {
      vestedAmount: 0,
      nextUnlockDate: null,
      nextUnlockAmount: 0,
      totalAmount: isEligible ? estimatedTokens : 0,
      schedule: [
        { month: 0, percent: 33.33, unlocked: false },
        { month: 1, percent: 33.33, unlocked: false },
        { month: 2, percent: 33.34, unlocked: false },
      ],
    },
    stats: {
      gamesPlayed,
      tournamentEntries,
      tournamentTop10Finishes,
      highScoreAchievements,
      discordMessages,
      zealyXP,
      zealyQuests,
      telegramMessages,
      stakedAmount,
      highestLockTier,
      isEarlyAdopter,
      methodsUsed, // Number of distinct participation methods
      breakdown: {
        gamePoints,
        tournamentEntryPoints,
        tournamentFinishPoints,
        highScorePoints,
        discordPoints,
        zealyPoints: Math.floor(zealyPoints),
        telegramPoints,
        stakingPoints,
        earlyAdopterMultiplier,
        breadthMultiplier, // Bonus for using multiple methods
        basePoints: totalPoints,
        weightedPoints, // Final weighted points
      },
    },
  };
}

/**
 * Get airdrop status for a wallet
 */
export const getAirdropStatus = onCall(async (request) => {
  try {
    const { wallet, snapshotId } = (request.data || {}) as { wallet?: string; snapshotId?: string };

    const targetWallet = (wallet || request.auth?.uid)?.toLowerCase();

    if (!targetWallet) {
      return {
        eligible: false,
        message: 'Wallet address required. Please connect your wallet.',
        status: 'no_wallet',
      };
    }

    console.log(`🔍 Checking airdrop status for ${targetWallet}`);

    // Get the latest active airdrop or specified snapshot
    let airdropDoc: FirebaseFirestore.DocumentSnapshot | null = null;

    if (snapshotId) {
      airdropDoc = await db.collection('airdrops').doc(snapshotId).get();
    } else {
      // Fetch all airdrops and filter in code (avoids Firestore index requirements)
      const allAirdrops = await db.collection('airdrops').get();

      if (allAirdrops.empty) {
        console.log('📭 No airdrops found in database - calculating real-time eligibility');
        // Return real-time eligibility based on actual user data
        return await calculateRealTimeEligibility(targetWallet);
      }

      // Sort by createdAt descending and find active or most recent
      const sortedAirdrops = allAirdrops.docs
        .map(doc => ({ doc, data: doc.data() }))
        .sort((a, b) => {
          const aTime = a.data.createdAt?.toMillis?.() || 0;
          const bTime = b.data.createdAt?.toMillis?.() || 0;
          return bTime - aTime;
        });

      // First try to find active airdrop
      const activeAirdrop = sortedAirdrops.find(a => a.data.status === 'active');
      if (activeAirdrop) {
        airdropDoc = activeAirdrop.doc;
      } else {
        // Fall back to most recent (for testing)
        airdropDoc = sortedAirdrops[0]?.doc || null;
      }
    }

    if (!airdropDoc || !airdropDoc.exists) {
      console.log('📭 No valid airdrop document - calculating real-time eligibility');
      // Return real-time eligibility based on actual user data
      return await calculateRealTimeEligibility(targetWallet);
    }

  const airdropData = airdropDoc.data()!;
  const airdropId = airdropDoc.id;

  // Get user's allocation
  const allocationDoc = await db.collection('airdrops')
    .doc(airdropId)
    .collection('allocations')
    .doc(targetWallet)
    .get();

  if (!allocationDoc.exists) {
    // If no allocation in snapshot, return real-time eligibility
    console.log(`📭 No allocation found for ${targetWallet} - calculating real-time eligibility`);
    return await calculateRealTimeEligibility(targetWallet);
  }

  const allocation = allocationDoc.data()!;

  // Calculate vesting status
  const now = new Date();
  const claimStartDate = allocation.claimedAt?.toDate() || null;
  let vestedAmount = 0;
  let nextUnlockDate: Date | null = null;
  let nextUnlockAmount = 0;

  if (claimStartDate) {
    const monthsSinceClaim = (now.getTime() - claimStartDate.getTime()) / (30 * 24 * 60 * 60 * 1000);

    if (monthsSinceClaim >= 2) {
      vestedAmount = allocation.tokenAmountFormatted; // 100%
    } else if (monthsSinceClaim >= 1) {
      vestedAmount = Math.floor(allocation.tokenAmountFormatted * 0.6666); // 66.66%
      nextUnlockDate = new Date(claimStartDate.getTime() + 60 * 24 * 60 * 60 * 1000);
      nextUnlockAmount = allocation.tokenAmountFormatted - vestedAmount;
    } else {
      vestedAmount = Math.floor(allocation.tokenAmountFormatted * 0.3333); // 33.33%
      nextUnlockDate = new Date(claimStartDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      nextUnlockAmount = Math.floor(allocation.tokenAmountFormatted * 0.3333);
    }
  }

  return {
    eligible: true,
    airdropId,
    wallet: allocation.wallet,
    tier: allocation.tier,
    rank: allocation.rank,
    points: allocation.points,
    tokenAmount: allocation.tokenAmount,
    tokenAmountFormatted: allocation.tokenAmountFormatted,
    proof: allocation.proof,
    claimed: allocation.claimed,
    claimedAt: allocation.claimedAt?.toDate()?.toISOString() || null,
    claimDeadline: airdropData.claimDeadline?.toDate()?.toISOString(),
    merkleRoot: airdropData.merkleRoot,
    contractAddress: airdropData.contractAddress || null,
    vesting: {
      vestedAmount,
      nextUnlockDate: nextUnlockDate?.toISOString() || null,
      nextUnlockAmount,
      totalAmount: allocation.tokenAmountFormatted,
      schedule: [
        { month: 0, percent: 33.33, unlocked: true },
        { month: 1, percent: 33.33, unlocked: claimStartDate ? (now.getTime() - claimStartDate.getTime()) >= 30 * 24 * 60 * 60 * 1000 : false },
        { month: 2, percent: 33.34, unlocked: claimStartDate ? (now.getTime() - claimStartDate.getTime()) >= 60 * 24 * 60 * 60 * 1000 : false },
      ],
    },
    status: airdropData.status,
  };
  } catch (error) {
    console.error('❌ getAirdropStatus error:', error);
    // Return a graceful error instead of throwing
    return {
      eligible: false,
      message: 'Unable to check airdrop status. Please try again later.',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

/**
 * Generate real-time leaderboard from actual user data in Firestore
 */
async function generateRealTimeLeaderboard(limit: number = 100) {
  console.log('📊 Generating real-time leaderboard from Firestore...');

  const leaderboardEntries: Array<{
    wallet: string;
    points: number;
    gamesPlayed: number;
    tier: 'legendary' | 'epic' | 'rare' | 'common';
    tokenAmountFormatted: number;
  }> = [];

  // Get all users with game activity
  const usersSnapshot = await db.collection('users')
    .where('totalGamesPlayed', '>', 0)
    .orderBy('totalGamesPlayed', 'desc')
    .limit(500)
    .get();

  console.log(`   Found ${usersSnapshot.size} users with games played`);

  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const wallet = userDoc.id.toLowerCase();
    const gamesPlayed = userData.totalGamesPlayed || 0;

    // Calculate points (simplified - just games for leaderboard)
    const gamePoints = calculateGamePoints(gamesPlayed);
    const points = gamePoints;

    // Determine tier based on points
    let tier: 'legendary' | 'epic' | 'rare' | 'common';
    let tokenAmountFormatted: number;

    if (points >= 500) {
      tier = 'legendary';
      tokenAmountFormatted = 500000 + Math.floor(points * 500);
    } else if (points >= 200) {
      tier = 'epic';
      tokenAmountFormatted = 200000 + Math.floor(points * 250);
    } else if (points >= 50) {
      tier = 'rare';
      tokenAmountFormatted = 75000 + Math.floor(points * 150);
    } else {
      tier = 'common';
      tokenAmountFormatted = 10000 + Math.floor(points * 100);
    }

    tokenAmountFormatted = Math.min(tokenAmountFormatted, 2000000);

    leaderboardEntries.push({
      wallet,
      points,
      gamesPlayed,
      tier,
      tokenAmountFormatted,
    });
  }

  // Sort by points descending
  leaderboardEntries.sort((a, b) => b.points - a.points);

  // Take top entries and add rank
  const leaderboard = leaderboardEntries.slice(0, limit).map((entry, index) => ({
    rank: index + 1,
    wallet: entry.wallet,
    tier: entry.tier,
    points: entry.points,
    tokenAmountFormatted: entry.tokenAmountFormatted,
    claimed: false,
  }));

  // Count tiers
  const tierStats = {
    legendary: leaderboard.filter(e => e.tier === 'legendary').length,
    epic: leaderboard.filter(e => e.tier === 'epic').length,
    rare: leaderboard.filter(e => e.tier === 'rare').length,
    common: leaderboard.filter(e => e.tier === 'common').length,
  };

  console.log(`   Leaderboard generated: ${leaderboard.length} entries`);
  console.log(`   Tiers: L=${tierStats.legendary}, E=${tierStats.epic}, R=${tierStats.rare}, C=${tierStats.common}`);

  return {
    airdropId: 'realtime_preview',
    leaderboard,
    total: leaderboardEntries.length,
    tierStats,
    status: 'preview',
    message: 'Live leaderboard based on current user activity',
  };
}

/**
 * Get airdrop leaderboard (for display on claim page)
 */
export const getAirdropLeaderboard = onCall(async (request) => {
  const { snapshotId, limit = 100 } = request.data as { snapshotId?: string; limit?: number };

  // Get the latest airdrop or specified snapshot
  let airdropId: string;

  if (snapshotId) {
    airdropId = snapshotId;
  } else {
    const airdropsSnapshot = await db.collection('airdrops')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (airdropsSnapshot.empty) {
      // Return real-time leaderboard from actual user data
      console.log('📭 No airdrops found - generating real-time leaderboard');
      return await generateRealTimeLeaderboard(limit);
    }

    airdropId = airdropsSnapshot.docs[0].id;
  }

  // Get top allocations
  const allocationsSnapshot = await db.collection('airdrops')
    .doc(airdropId)
    .collection('allocations')
    .orderBy('rank', 'asc')
    .limit(Math.min(limit, 100))
    .get();

  // If no allocations found, return real-time data
  if (allocationsSnapshot.empty) {
    console.log('📭 No allocations found - generating real-time leaderboard');
    return await generateRealTimeLeaderboard(limit);
  }

  const leaderboard = allocationsSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      rank: data.rank,
      wallet: data.wallet,
      tier: data.tier,
      points: data.points,
      tokenAmountFormatted: data.tokenAmountFormatted,
      claimed: data.claimed,
    };
  });

  // Get total count
  const airdropDoc = await db.collection('airdrops').doc(airdropId).get();
  const total = airdropDoc.data()?.totalRecipients || 0;

  return {
    airdropId,
    leaderboard,
    total,
    tierStats: airdropDoc.data()?.tierStats,
  };
});

/**
 * Mark a claim as completed (called after successful on-chain claim)
 */
export const markAirdropClaimed = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const { snapshotId, txHash } = request.data as { snapshotId: string; txHash: string };
  const wallet = request.auth.uid.toLowerCase();

  const allocationRef = db.collection('airdrops')
    .doc(snapshotId)
    .collection('allocations')
    .doc(wallet);

  const allocationDoc = await allocationRef.get();

  if (!allocationDoc.exists) {
    throw new HttpsError('not-found', 'Allocation not found');
  }

  await allocationRef.update({
    claimed: true,
    claimedAt: Timestamp.now(),
    claimTxHash: txHash,
  });

  console.log(`✅ Marked airdrop claim for ${wallet} - tx: ${txHash}`);

  return { success: true };
});

/**
 * ADMIN: Set airdrop contract address after deployment
 */
export const setAirdropContract = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const { snapshotId, contractAddress } = request.data as { snapshotId: string; contractAddress: string };

  const airdropRef = db.collection('airdrops').doc(snapshotId);
  const airdropDoc = await airdropRef.get();

  if (!airdropDoc.exists) {
    throw new HttpsError('not-found', 'Airdrop snapshot not found');
  }

  await airdropRef.update({
    contractAddress,
    status: 'active',
    activatedAt: Timestamp.now(),
  });

  console.log(`✅ Airdrop ${snapshotId} activated with contract ${contractAddress}`);

  return { success: true };
});

/**
 * ADMIN: Get all user allocations for admin dashboard
 * Returns all users with their activity stats and estimated token allocations
 */
export const getAdminAirdropAllocations = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  // Admin wallet addresses that can access this endpoint
  const ADMIN_WALLETS = [
    '0x96e0b627454ce3b8c55c6d36b5fcbb13849dc297',
  ];

  const callerAddress = request.auth.uid.toLowerCase();

  if (!ADMIN_WALLETS.includes(callerAddress)) {
    throw new HttpsError('permission-denied', 'Only admins can access this data');
  }

  console.log('📊 Admin fetching all user allocations...');

  try {
    const users: Array<{
      wallet: string;
      gamesPlayed: number;
      totalPoints: number;
      tier: string;
      tokenAmount: number;
      tournamentEntries: number;
      discordMessages: number;
      telegramMessages: number;
      stakedAmount: number;
      zealyXP: number;
      isEarlyAdopter: boolean;
      createdAt?: string;
    }> = [];

    // Get all users with game activity
    const usersSnapshot = await db.collection('users')
      .orderBy('totalGamesPlayed', 'desc')
      .get();

    console.log(`   Found ${usersSnapshot.size} users`);

    // Get Discord links for all users
    const discordLinksSnapshot = await db.collection('discord_links').get();
    const walletToDiscord: Map<string, string> = new Map();
    for (const doc of discordLinksSnapshot.docs) {
      const data = doc.data();
      if (data.walletAddress) {
        walletToDiscord.set(data.walletAddress.toLowerCase(), doc.id);
      }
    }

    // Get Discord activity
    const discordActivitySnapshot = await db.collection('discord_activity').get();
    const discordActivity: Map<string, number> = new Map();
    for (const doc of discordActivitySnapshot.docs) {
      discordActivity.set(doc.id, doc.data().messageCount || 0);
    }

    // Get Zealy data
    const zealySnapshot = await db.collection('zealy_users').get();
    const zealyData: Map<string, number> = new Map();
    for (const doc of zealySnapshot.docs) {
      zealyData.set(doc.id.toLowerCase(), doc.data().xp || 0);
    }

    // Get Telegram links and activity
    const telegramLinksAdminSnapshot = await db.collection('telegram_links').get();
    const walletToTelegramAdmin: Map<string, string> = new Map();
    for (const doc of telegramLinksAdminSnapshot.docs) {
      const data = doc.data();
      if (data.walletAddress) {
        walletToTelegramAdmin.set(data.walletAddress.toLowerCase(), doc.id);
      }
    }

    const telegramActivityAdminSnapshot = await db.collection('telegram_activity').get();
    const telegramActivityAdmin: Map<string, number> = new Map();
    for (const doc of telegramActivityAdminSnapshot.docs) {
      telegramActivityAdmin.set(doc.id, doc.data().messageCount || 0);
    }

    // Pre-fetch staking data for all wallets
    console.log('   Fetching on-chain staking data...');
    const stakingContract = getStakingContract();
    const walletStakingData: Map<string, { stakedAmount: number; highestLockTier: number; stakingPoints: number }> = new Map();
    if (stakingContract) {
      for (const userDoc of usersSnapshot.docs) {
        const wallet = userDoc.id.toLowerCase();
        try {
          const result = await calculateStakingPoints(stakingContract, wallet);
          if (result.stakedAmount > 0) {
            walletStakingData.set(wallet, result);
          }
        } catch {
          // Skip wallets that fail
        }
      }
      console.log(`   Found ${walletStakingData.size} stakers`);
    } else {
      console.log('   ⚠️ Staking contract not available, skipping');
    }

    // Pre-fetch tournament entries for all users (avoid N*M queries)
    console.log('   Fetching tournament entries...');
    const tournamentEntriesMap: Map<string, number> = new Map();
    const tournamentsSnapshot = await db.collection('tournaments').get();

    for (const tournamentDoc of tournamentsSnapshot.docs) {
      const entriesSnapshot = await db.collection('tournaments')
        .doc(tournamentDoc.id)
        .collection('entries')
        .get();

      for (const entryDoc of entriesSnapshot.docs) {
        const wallet = entryDoc.id.toLowerCase();
        tournamentEntriesMap.set(wallet, (tournamentEntriesMap.get(wallet) || 0) + 1);
      }
    }
    console.log(`   Found ${tournamentEntriesMap.size} users with tournament entries`);

    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const wallet = userDoc.id.toLowerCase();
      const gamesPlayed = userData.totalGamesPlayed || 0;

      // Calculate game points
      const gamePoints = calculateGamePoints(gamesPlayed);

      // Get Discord messages
      const discordId = walletToDiscord.get(wallet);
      const discordMessages = discordId ? (discordActivity.get(discordId) || 0) : 0;
      let discordPoints = 0;
      if (discordId) {
        discordPoints = DISCORD_POINTS.PLAYER_1;
        if (discordMessages >= 500) {
          discordPoints += DISCORD_POINTS.LEADERBOARD_LEGEND;
        } else if (discordMessages >= 200) {
          discordPoints += DISCORD_POINTS.HIGH_SCORER;
        } else if (discordMessages >= 50) {
          discordPoints += DISCORD_POINTS.ARCADE_REGULAR;
        }
      }

      // Get Zealy XP
      const zealyXP = zealyData.get(wallet) || 0;
      const zealyPoints = Math.min(zealyXP / 10, 200);

      // Get Telegram messages
      const telegramId = walletToTelegramAdmin.get(wallet);
      const telegramMessages = telegramId ? (telegramActivityAdmin.get(telegramId) || 0) : 0;
      let telegramPoints = 0;
      if (telegramId) {
        telegramPoints = TELEGRAM_POINTS.LINKED;
        if (telegramMessages >= 500) {
          telegramPoints += TELEGRAM_POINTS.ACTIVE_500;
        } else if (telegramMessages >= 200) {
          telegramPoints += TELEGRAM_POINTS.ACTIVE_200;
        } else if (telegramMessages >= 50) {
          telegramPoints += TELEGRAM_POINTS.ACTIVE_50;
        }
      }

      // Get staking data
      const staking = walletStakingData.get(wallet);
      const stakedAmount = staking?.stakedAmount || 0;
      const stakingPts = staking?.stakingPoints || 0;

      // Check early adopter
      const createdAt = userData.createdAt?.toDate?.();
      const isEarlyAdopter = createdAt ? createdAt < new Date('2024-06-01') : false;
      const multiplier = isEarlyAdopter ? 2.0 : 1.0;

      // Calculate total points (including staking)
      const totalPoints = Math.floor((gamePoints + discordPoints + zealyPoints + telegramPoints + stakingPts) * multiplier);

      // Determine tier and tokens
      let tier: string;
      let tokenAmount: number;

      if (totalPoints >= 500) {
        tier = 'legendary';
        tokenAmount = 500000 + Math.floor(totalPoints * 500);
      } else if (totalPoints >= 200) {
        tier = 'epic';
        tokenAmount = 200000 + Math.floor(totalPoints * 250);
      } else if (totalPoints >= 50) {
        tier = 'rare';
        tokenAmount = 75000 + Math.floor(totalPoints * 150);
      } else {
        tier = 'common';
        tokenAmount = 10000 + Math.floor(totalPoints * 100);
      }

      tokenAmount = Math.min(tokenAmount, 2000000);

      // Get tournament entries from pre-fetched map
      const tournamentEntries = tournamentEntriesMap.get(wallet) || 0;

      users.push({
        wallet,
        gamesPlayed,
        totalPoints,
        tier,
        tokenAmount,
        tournamentEntries,
        discordMessages,
        telegramMessages,
        stakedAmount,
        zealyXP,
        isEarlyAdopter,
        createdAt: createdAt?.toISOString(),
      });
    }

    // Sort by total points descending
    users.sort((a, b) => b.totalPoints - a.totalPoints);

    console.log(`✅ Admin data prepared: ${users.length} users`);

    return {
      users,
      total: users.length,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ getAdminAirdropAllocations error:', error);
    throw new HttpsError('internal', `Failed to fetch admin data: ${error}`);
  }
});
