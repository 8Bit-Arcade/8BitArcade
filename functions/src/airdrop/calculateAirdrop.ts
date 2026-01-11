import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, Timestamp } from '../config/firebase';
import { keccak256, encodePacked } from 'viem';

/**
 * Airdrop Calculation System for 8-Bit Arcade Testnet Rewards
 *
 * Allocates 15 million 8BIT tokens (3% marketing allocation) to testnet participants
 * based on their activity and achievements.
 *
 * Point System:
 * - Games Played: 1 point each (max 500 points)
 * - High Score Rankings: 10-50 points per game
 * - Tournament Entries: 25 points each
 * - Tournament Top 10 Finish: 100 points each
 * - Early Adopter Bonus: 2x multiplier for first 100 users
 *
 * Allocation Tiers (of 15M total):
 * - Legendary (Top 1%): 3M tokens
 * - Epic (Top 5%): 4M tokens
 * - Rare (Top 20%): 5M tokens
 * - Common (All eligible): 3M tokens
 *
 * Minimum eligibility: 5 games played OR 1 tournament entry
 */

// Constants
const TOTAL_AIRDROP_TOKENS = 10_000_000; // 10 million tokens
const TOKENS_DECIMALS = 18;

// Point caps to prevent gaming
const MAX_GAME_POINTS = 500; // Cap at 500 games
const DIMINISHING_RETURNS_THRESHOLD = 100; // Full points for first 100 games

// Minimum eligibility
const MIN_GAMES_FOR_ELIGIBILITY = 5;
const MIN_TOURNAMENT_ENTRIES = 1;

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
  breakdown: {
    gamePoints: number;
    tournamentEntryPoints: number;
    tournamentFinishPoints: number;
    highScorePoints: number;
    multiplier: number;
  };
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
 * Helper: Calculate points with diminishing returns
 */
function calculateGamePoints(gamesPlayed: number): number {
  if (gamesPlayed <= DIMINISHING_RETURNS_THRESHOLD) {
    return gamesPlayed;
  }

  // First 100 games = 100 points
  // Games 101-500 = 0.5 points each (max 200 more points)
  const basePoints = DIMINISHING_RETURNS_THRESHOLD;
  const additionalGames = Math.min(gamesPlayed - DIMINISHING_RETURNS_THRESHOLD, MAX_GAME_POINTS - DIMINISHING_RETURNS_THRESHOLD);
  const additionalPoints = Math.floor(additionalGames * 0.5);

  return Math.min(basePoints + additionalPoints, MAX_GAME_POINTS);
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
        breakdown: {
          gamePoints: 0,
          tournamentEntryPoints: 0,
          tournamentFinishPoints: 0,
          highScorePoints: 0,
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
  // 5. Calculate final points for each player
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

    // Calculate total points
    const basePoints =
      player.breakdown.gamePoints +
      player.breakdown.tournamentEntryPoints +
      player.breakdown.tournamentFinishPoints +
      player.breakdown.highScorePoints;

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
 * Filter eligible players and calculate allocations
 */
function calculateAllocations(players: PlayerScore[]): AirdropAllocation[] {
  console.log('💰 Calculating token allocations...');

  // Filter for eligible players
  const eligible = players.filter(p =>
    p.gamesPlayed >= MIN_GAMES_FOR_ELIGIBILITY ||
    p.tournamentEntries >= MIN_TOURNAMENT_ENTRIES
  );

  console.log(`   ${eligible.length} players eligible (of ${players.length} total)`);

  if (eligible.length === 0) {
    console.log('   ⚠️ No eligible players found!');
    return [];
  }

  // Calculate tier boundaries
  const totalEligible = eligible.length;
  const legendaryCount = Math.max(1, Math.floor(totalEligible * TIER_ALLOCATIONS.legendary.percent));
  const epicCount = Math.max(1, Math.floor(totalEligible * TIER_ALLOCATIONS.epic.percent)) - legendaryCount;
  const rareCount = Math.max(1, Math.floor(totalEligible * TIER_ALLOCATIONS.rare.percent)) - legendaryCount - epicCount;
  const commonCount = totalEligible - legendaryCount - epicCount - rareCount;

  console.log(`   Tier distribution:`);
  console.log(`   - Legendary (top ${legendaryCount}): ${TIER_ALLOCATIONS.legendary.tokens.toLocaleString()} tokens`);
  console.log(`   - Epic (next ${epicCount}): ${TIER_ALLOCATIONS.epic.tokens.toLocaleString()} tokens`);
  console.log(`   - Rare (next ${rareCount}): ${TIER_ALLOCATIONS.rare.tokens.toLocaleString()} tokens`);
  console.log(`   - Common (remaining ${commonCount}): ${TIER_ALLOCATIONS.common.tokens.toLocaleString()} tokens`);

  // Assign tiers and calculate per-player allocations
  const allocations: AirdropAllocation[] = [];

  // Calculate tokens per player in each tier (weighted by points within tier)
  const assignTier = (
    startIndex: number,
    count: number,
    tier: 'legendary' | 'epic' | 'rare' | 'common',
    totalTokens: number
  ) => {
    const tierPlayers = eligible.slice(startIndex, startIndex + count);
    const totalPoints = tierPlayers.reduce((sum, p) => sum + p.points, 0);

    for (let i = 0; i < tierPlayers.length; i++) {
      const player = tierPlayers[i];
      // Weight by points within tier
      const shareOfTier = totalPoints > 0 ? player.points / totalPoints : 1 / tierPlayers.length;
      const tokenAmount = Math.floor(totalTokens * shareOfTier);

      // Convert to wei (18 decimals)
      const tokenAmountWei = BigInt(tokenAmount) * BigInt(10 ** TOKENS_DECIMALS);

      allocations.push({
        wallet: player.wallet,
        points: player.points,
        tier,
        tokenAmount: tokenAmountWei.toString(),
        tokenAmountFormatted: tokenAmount,
        rank: startIndex + i + 1,
      });
    }
  };

  let currentIndex = 0;

  // Legendary tier
  if (legendaryCount > 0) {
    assignTier(currentIndex, legendaryCount, 'legendary', TIER_ALLOCATIONS.legendary.tokens);
    currentIndex += legendaryCount;
  }

  // Epic tier
  if (epicCount > 0) {
    assignTier(currentIndex, epicCount, 'epic', TIER_ALLOCATIONS.epic.tokens);
    currentIndex += epicCount;
  }

  // Rare tier
  if (rareCount > 0) {
    assignTier(currentIndex, rareCount, 'rare', TIER_ALLOCATIONS.rare.tokens);
    currentIndex += rareCount;
  }

  // Common tier
  if (commonCount > 0) {
    assignTier(currentIndex, commonCount, 'common', TIER_ALLOCATIONS.common.tokens);
  }

  // Verify total allocation
  const totalAllocated = allocations.reduce((sum, a) => sum + a.tokenAmountFormatted, 0);
  console.log(`   Total allocated: ${totalAllocated.toLocaleString()} tokens`);

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
        console.log('📭 No airdrops found in database');
        return {
          eligible: false,
          message: 'No airdrop has been created yet. Check back soon!',
          status: 'no_airdrop',
        };
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
      return {
        eligible: false,
        message: 'No airdrop has been created yet. Check back soon!',
        status: 'no_airdrop',
      };
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
    // Check player details to show why they didn't qualify
    const detailsDoc = await db.collection('airdrops')
      .doc(airdropId)
      .collection('playerDetails')
      .doc(targetWallet)
      .get();

    return {
      eligible: false,
      message: 'Not eligible for airdrop',
      reason: 'Did not meet minimum requirements (5 games or 1 tournament entry)',
      stats: detailsDoc.exists ? detailsDoc.data() : null,
    };
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
      return { leaderboard: [], total: 0 };
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
