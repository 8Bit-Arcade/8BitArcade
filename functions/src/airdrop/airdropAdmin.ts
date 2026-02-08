import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, Timestamp } from '../config/firebase';

/**
 * Airdrop Admin Control System
 *
 * Provides full admin control over the airdrop:
 * - Start/Pause/Resume/Stop airdrop
 * - Schedule airdrop start and end times
 * - Edit user wallets
 * - Override user allocations
 * - Test airdrop distribution (testnet)
 */

// Admin wallet addresses
const ADMIN_WALLETS = [
  '0x96e0b627454ce3b8c55c6d36b5fcbb13849dc297',
];

// Note: Exclusion lists for airdrop rewards are maintained in calculateAirdrop.ts
// Owner/team wallets are tracked but don't receive tokens

// Current system version for migrations
const SYSTEM_VERSION = '1.0.0';

// Airdrop config interface
interface AirdropConfig {
  id: string;
  status: string;
  scheduledStart: any;
  scheduledEnd: any;
  actualStart: any;
  actualEnd: any;
  isPaused: boolean;
  pausedAt: any;
  totalTokenPool: number;
  snapshotId: string | null;
  contractAddress: string | null;
  testMode: boolean;
  createdAt: any;
  updatedAt: any;
  endReason?: string;
  updatedBy?: string;
  // Upgradability fields
  version?: string;
  emergencyPaused?: boolean;
  emergencyPausedAt?: any;
  emergencyPausedBy?: string;
}

// Tier configuration interface
interface TierConfig {
  name: string;
  minPoints: number;
  maxPoints: number;
  poolPercentage: number;
}

// Audit log entry interface
interface AuditLogEntry {
  id?: string;
  action: string;
  targetWallet?: string;
  data?: Record<string, any>;
  performedBy: string;
  performedAt: any;
  ipAddress?: string;
}

/**
 * Verify the caller is an admin
 */
function verifyAdmin(request: { auth?: { uid?: string } }) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  const callerAddress = request.auth.uid?.toLowerCase();
  if (!callerAddress || !ADMIN_WALLETS.includes(callerAddress)) {
    throw new HttpsError('permission-denied', 'Only admins can access this function');
  }

  return callerAddress;
}

/**
 * Log an admin action to the audit log
 */
async function logAuditAction(entry: Omit<AuditLogEntry, 'id'>): Promise<string> {
  const docRef = await db.collection('airdrop_audit_log').add({
    ...entry,
    performedAt: Timestamp.now(),
  });
  return docRef.id;
}

/**
 * Get or create the airdrop config document
 */
async function getAirdropConfig(): Promise<AirdropConfig> {
  const configRef = db.collection('airdrop_config').doc('current');
  const configDoc = await configRef.get();

  if (!configDoc.exists) {
    // Create default config
    const defaultConfig: AirdropConfig = {
      id: 'current',
      status: 'inactive',
      scheduledStart: null,
      scheduledEnd: null,
      actualStart: null,
      actualEnd: null,
      isPaused: false,
      pausedAt: null,
      totalTokenPool: 10_000_000,
      snapshotId: null,
      contractAddress: null,
      testMode: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      version: SYSTEM_VERSION,
      emergencyPaused: false,
    };
    await configRef.set(defaultConfig);
    return defaultConfig;
  }

  return { id: configDoc.id, ...configDoc.data() } as AirdropConfig;
}

/**
 * Get airdrop configuration and status
 */
export const getAirdropConfig_fn = onCall({ cors: true }, async (request) => {
  verifyAdmin(request);

  const config = await getAirdropConfig();

  // Get stats
  const usersSnapshot = await db.collection('users').count().get();
  const allocationsCount = config.snapshotId
    ? (await db.collection('airdrops').doc(config.snapshotId).collection('allocations').count().get()).data().count
    : 0;

  return {
    config,
    stats: {
      totalUsers: usersSnapshot.data().count,
      totalAllocations: allocationsCount,
    },
  };
});

/**
 * Update airdrop configuration
 */
export const updateAirdropConfig = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const {
    totalTokenPool,
    scheduledStart,
    scheduledEnd,
    testMode,
    contractAddress,
  } = request.data as {
    totalTokenPool?: number;
    scheduledStart?: string | null;
    scheduledEnd?: string | null;
    testMode?: boolean;
    contractAddress?: string | null;
  };

  const configRef = db.collection('airdrop_config').doc('current');
  const updateData: Record<string, any> = {
    updatedAt: Timestamp.now(),
    updatedBy: adminWallet,
  };

  if (totalTokenPool !== undefined) {
    updateData.totalTokenPool = totalTokenPool;
  }

  if (scheduledStart !== undefined) {
    updateData.scheduledStart = scheduledStart ? Timestamp.fromDate(new Date(scheduledStart)) : null;
  }

  if (scheduledEnd !== undefined) {
    updateData.scheduledEnd = scheduledEnd ? Timestamp.fromDate(new Date(scheduledEnd)) : null;
  }

  if (testMode !== undefined) {
    updateData.testMode = testMode;
  }

  if (contractAddress !== undefined) {
    updateData.contractAddress = contractAddress;
  }

  await configRef.set(updateData, { merge: true });

  console.log(`✅ Airdrop config updated by ${adminWallet}`);

  return { success: true, updated: updateData };
});

/**
 * Start the airdrop (or schedule it)
 */
export const startAirdrop = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const { immediate, scheduledStart } = request.data as {
    immediate?: boolean;
    scheduledStart?: string;
  };

  const configRef = db.collection('airdrop_config').doc('current');
  const config = await getAirdropConfig();

  if (config.status === 'active') {
    throw new HttpsError('failed-precondition', 'Airdrop is already active');
  }

  const updateData: Record<string, any> = {
    updatedAt: Timestamp.now(),
    updatedBy: adminWallet,
    isPaused: false,
    pausedAt: null,
  };

  if (immediate) {
    updateData.status = 'active';
    updateData.actualStart = Timestamp.now();
    console.log(`🚀 Airdrop started immediately by ${adminWallet}`);
  } else if (scheduledStart) {
    updateData.status = 'scheduled';
    updateData.scheduledStart = Timestamp.fromDate(new Date(scheduledStart));
    console.log(`📅 Airdrop scheduled for ${scheduledStart} by ${adminWallet}`);
  } else {
    throw new HttpsError('invalid-argument', 'Must specify immediate=true or scheduledStart');
  }

  await configRef.set(updateData, { merge: true });

  return {
    success: true,
    status: updateData.status,
    startTime: immediate ? 'now' : scheduledStart,
  };
});

/**
 * Pause the airdrop
 */
export const pauseAirdrop = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const config = await getAirdropConfig();

  if (config.status !== 'active') {
    throw new HttpsError('failed-precondition', 'Airdrop is not active');
  }

  if (config.isPaused) {
    throw new HttpsError('failed-precondition', 'Airdrop is already paused');
  }

  const configRef = db.collection('airdrop_config').doc('current');
  await configRef.set({
    isPaused: true,
    pausedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    updatedBy: adminWallet,
  }, { merge: true });

  console.log(`⏸️ Airdrop paused by ${adminWallet}`);

  return { success: true, message: 'Airdrop paused' };
});

/**
 * Resume the airdrop
 */
export const resumeAirdrop = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const config = await getAirdropConfig();

  if (!config.isPaused) {
    throw new HttpsError('failed-precondition', 'Airdrop is not paused');
  }

  const configRef = db.collection('airdrop_config').doc('current');
  await configRef.set({
    isPaused: false,
    pausedAt: null,
    updatedAt: Timestamp.now(),
    updatedBy: adminWallet,
  }, { merge: true });

  console.log(`▶️ Airdrop resumed by ${adminWallet}`);

  return { success: true, message: 'Airdrop resumed' };
});

/**
 * Stop/End the airdrop
 */
export const stopAirdrop = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const { reason } = request.data as { reason?: string };

  const config = await getAirdropConfig();

  if (config.status === 'completed' || config.status === 'inactive') {
    throw new HttpsError('failed-precondition', 'Airdrop is already stopped');
  }

  const configRef = db.collection('airdrop_config').doc('current');
  await configRef.set({
    status: 'completed',
    actualEnd: Timestamp.now(),
    endReason: reason || 'Manual stop by admin',
    isPaused: false,
    updatedAt: Timestamp.now(),
    updatedBy: adminWallet,
  }, { merge: true });

  console.log(`🛑 Airdrop stopped by ${adminWallet}. Reason: ${reason || 'Manual stop'}`);

  return { success: true, message: 'Airdrop stopped' };
});

/**
 * Extend the airdrop end date
 */
export const extendAirdrop = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const { newEndDate } = request.data as { newEndDate: string };

  if (!newEndDate) {
    throw new HttpsError('invalid-argument', 'newEndDate is required');
  }

  const configRef = db.collection('airdrop_config').doc('current');
  await configRef.set({
    scheduledEnd: Timestamp.fromDate(new Date(newEndDate)),
    updatedAt: Timestamp.now(),
    updatedBy: adminWallet,
  }, { merge: true });

  console.log(`📅 Airdrop extended to ${newEndDate} by ${adminWallet}`);

  return { success: true, newEndDate };
});

/**
 * Edit a user's receiving wallet address
 */
export const editUserWallet = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const { oldWallet, newWallet, reason } = request.data as {
    oldWallet: string;
    newWallet: string;
    reason?: string;
  };

  if (!oldWallet || !newWallet) {
    throw new HttpsError('invalid-argument', 'oldWallet and newWallet are required');
  }

  const normalizedOld = oldWallet.toLowerCase();
  const normalizedNew = newWallet.toLowerCase();

  // Validate wallet format
  if (!normalizedNew.startsWith('0x') || normalizedNew.length !== 42) {
    throw new HttpsError('invalid-argument', 'Invalid wallet address format');
  }

  // Check if new wallet already exists
  const existingUser = await db.collection('users').doc(normalizedNew).get();
  if (existingUser.exists) {
    throw new HttpsError('already-exists', 'New wallet already has an account');
  }

  // Get old user data
  const oldUserDoc = await db.collection('users').doc(normalizedOld).get();
  if (!oldUserDoc.exists) {
    throw new HttpsError('not-found', 'Old wallet not found');
  }

  const batch = db.batch();

  // Copy user data to new wallet
  batch.set(db.collection('users').doc(normalizedNew), {
    ...oldUserDoc.data(),
    previousWallet: normalizedOld,
    walletChangedAt: Timestamp.now(),
    walletChangedBy: adminWallet,
    walletChangeReason: reason || 'Admin wallet change',
  });

  // Update any airdrop allocations
  const config = await getAirdropConfig();
  if (config.snapshotId) {
    const oldAllocation = await db.collection('airdrops')
      .doc(config.snapshotId)
      .collection('allocations')
      .doc(normalizedOld)
      .get();

    if (oldAllocation.exists) {
      const allocationData = oldAllocation.data()!;
      batch.set(
        db.collection('airdrops').doc(config.snapshotId).collection('allocations').doc(normalizedNew),
        {
          ...allocationData,
          wallet: normalizedNew,
          previousWallet: normalizedOld,
          walletChangedAt: Timestamp.now(),
        }
      );
      batch.delete(db.collection('airdrops').doc(config.snapshotId).collection('allocations').doc(normalizedOld));
    }
  }

  // Update Discord link if exists
  const discordLinks = await db.collection('discord_links')
    .where('walletAddress', '==', normalizedOld)
    .get();

  for (const doc of discordLinks.docs) {
    batch.update(doc.ref, { walletAddress: normalizedNew });
  }

  // Log the change
  batch.set(db.collection('wallet_changes').doc(), {
    oldWallet: normalizedOld,
    newWallet: normalizedNew,
    reason: reason || 'Admin wallet change',
    changedBy: adminWallet,
    changedAt: Timestamp.now(),
  });

  // Delete old user document (optional - you might want to keep it for audit)
  // batch.delete(db.collection('users').doc(normalizedOld));

  await batch.commit();

  console.log(`✅ Wallet changed: ${normalizedOld} -> ${normalizedNew} by ${adminWallet}`);

  return {
    success: true,
    oldWallet: normalizedOld,
    newWallet: normalizedNew,
  };
});

/**
 * Override a user's allocation
 */
export const overrideUserAllocation = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const {
    wallet,
    tokenAmount,
    tier,
    points,
    reason,
  } = request.data as {
    wallet: string;
    tokenAmount?: number;
    tier?: 'legendary' | 'epic' | 'rare' | 'common';
    points?: number;
    reason?: string;
  };

  if (!wallet) {
    throw new HttpsError('invalid-argument', 'wallet is required');
  }

  const normalizedWallet = wallet.toLowerCase();

  // Get current config to find active snapshot
  const config = await getAirdropConfig();

  const overrideData: Record<string, any> = {
    wallet: normalizedWallet,
    isOverride: true,
    overrideBy: adminWallet,
    overrideAt: Timestamp.now(),
    overrideReason: reason || 'Admin override',
  };

  if (tokenAmount !== undefined) {
    overrideData.tokenAmountFormatted = tokenAmount;
    overrideData.tokenAmount = (BigInt(tokenAmount) * BigInt(10 ** 18)).toString();
  }

  if (tier !== undefined) {
    overrideData.tier = tier;
  }

  if (points !== undefined) {
    overrideData.points = points;
  }

  // Store override in dedicated collection
  await db.collection('allocation_overrides').doc(normalizedWallet).set(overrideData, { merge: true });

  // If there's an active snapshot, update the allocation there too
  if (config.snapshotId) {
    await db.collection('airdrops')
      .doc(config.snapshotId)
      .collection('allocations')
      .doc(normalizedWallet)
      .set(overrideData, { merge: true });
  }

  console.log(`✅ Allocation override for ${normalizedWallet} by ${adminWallet}:`, overrideData);

  return { success: true, override: overrideData };
});

/**
 * Get all allocation overrides
 */
export const getAllocationOverrides = onCall({ cors: true }, async (request) => {
  verifyAdmin(request);

  const overridesSnapshot = await db.collection('allocation_overrides')
    .orderBy('overrideAt', 'desc')
    .get();

  const overrides = overridesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    overrideAt: doc.data().overrideAt?.toDate?.()?.toISOString(),
  }));

  return { overrides };
});

/**
 * Remove an allocation override
 */
export const removeAllocationOverride = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const { wallet } = request.data as { wallet: string };

  if (!wallet) {
    throw new HttpsError('invalid-argument', 'wallet is required');
  }

  const normalizedWallet = wallet.toLowerCase();

  await db.collection('allocation_overrides').doc(normalizedWallet).delete();

  console.log(`✅ Allocation override removed for ${normalizedWallet} by ${adminWallet}`);

  return { success: true };
});

/**
 * Get wallet change history
 */
export const getWalletChangeHistory = onCall({ cors: true }, async (request) => {
  verifyAdmin(request);

  const changesSnapshot = await db.collection('wallet_changes')
    .orderBy('changedAt', 'desc')
    .limit(100)
    .get();

  const changes = changesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    changedAt: doc.data().changedAt?.toDate?.()?.toISOString(),
  }));

  return { changes };
});

/**
 * Test airdrop distribution (testnet only)
 * Simulates sending tokens to eligible users
 */
export const testAirdropDistribution = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const { wallets, tokenAmount } = request.data as {
    wallets?: string[];
    tokenAmount?: number;
  };

  const config = await getAirdropConfig();

  if (!config.testMode) {
    throw new HttpsError('failed-precondition', 'Test mode is not enabled');
  }

  // If no wallets specified, get all eligible users
  let targetWallets: string[] = wallets || [];

  if (targetWallets.length === 0) {
    const usersSnapshot = await db.collection('users')
      .where('totalGamesPlayed', '>=', 5)
      .limit(100)
      .get();

    targetWallets = usersSnapshot.docs.map(doc => doc.id.toLowerCase());
  }

  // Create test distribution records
  const batch = db.batch();
  const distributionId = `test_${Date.now()}`;

  for (const wallet of targetWallets) {
    batch.set(db.collection('test_distributions').doc(`${distributionId}_${wallet}`), {
      distributionId,
      wallet: wallet.toLowerCase(),
      tokenAmount: tokenAmount || 1000,
      status: 'pending',
      createdAt: Timestamp.now(),
      createdBy: adminWallet,
    });
  }

  await batch.commit();

  console.log(`🧪 Test distribution created: ${distributionId} for ${targetWallets.length} wallets`);

  return {
    success: true,
    distributionId,
    walletCount: targetWallets.length,
    tokenPerWallet: tokenAmount || 1000,
  };
});

/**
 * Get dashboard stats for admin
 */
export const getAirdropDashboardStats = onCall({ cors: true }, async (request) => {
  verifyAdmin(request);

  const config = await getAirdropConfig();

  // Get user counts by tier
  const usersSnapshot = await db.collection('users').get();
  let totalUsers = 0;
  let eligibleUsers = 0;
  let totalGamesPlayed = 0;

  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    totalUsers++;
    totalGamesPlayed += data.totalGamesPlayed || 0;
    if ((data.totalGamesPlayed || 0) >= 5) {
      eligibleUsers++;
    }
  }

  // Get Discord stats
  const discordLinksCount = (await db.collection('discord_links').count().get()).data().count;
  const discordActivitySnapshot = await db.collection('discord_activity').get();
  let totalDiscordMessages = 0;
  for (const doc of discordActivitySnapshot.docs) {
    totalDiscordMessages += doc.data().messageCount || 0;
  }

  // Get Telegram stats
  const telegramLinksCount = (await db.collection('telegram_links').count().get()).data().count;

  // Get Zealy stats
  const zealyUsersCount = (await db.collection('zealy_users').count().get()).data().count;

  // Get allocation overrides count
  const overridesCount = (await db.collection('allocation_overrides').count().get()).data().count;

  // Get claimed count if snapshot exists
  let claimedCount = 0;
  let totalAllocated = 0;
  if (config.snapshotId) {
    const allocationsSnapshot = await db.collection('airdrops')
      .doc(config.snapshotId)
      .collection('allocations')
      .get();

    for (const doc of allocationsSnapshot.docs) {
      const data = doc.data();
      totalAllocated += data.tokenAmountFormatted || 0;
      if (data.claimed) {
        claimedCount++;
      }
    }
  }

  return {
    config: {
      status: config.status,
      isPaused: config.isPaused,
      scheduledStart: config.scheduledStart?.toDate?.()?.toISOString(),
      scheduledEnd: config.scheduledEnd?.toDate?.()?.toISOString(),
      actualStart: config.actualStart?.toDate?.()?.toISOString(),
      testMode: config.testMode,
      totalTokenPool: config.totalTokenPool,
    },
    stats: {
      totalUsers,
      eligibleUsers,
      totalGamesPlayed,
      discordLinksCount,
      totalDiscordMessages,
      telegramLinksCount,
      zealyUsersCount,
      overridesCount,
      claimedCount,
      totalAllocated,
    },
  };
});

// ============================================================================
// FUTURE-PROOFING FUNCTIONS
// ============================================================================

/**
 * Blacklist a wallet from claiming the airdrop
 */
export const blacklistWallet = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const { wallet, reason } = request.data as {
    wallet: string;
    reason?: string;
  };

  if (!wallet) {
    throw new HttpsError('invalid-argument', 'wallet is required');
  }

  const normalizedWallet = wallet.toLowerCase();

  await db.collection('airdrop_blacklist').doc(normalizedWallet).set({
    wallet: normalizedWallet,
    reason: reason || 'Blacklisted by admin',
    blacklistedBy: adminWallet,
    blacklistedAt: Timestamp.now(),
    isActive: true,
  });

  await logAuditAction({
    action: 'BLACKLIST_WALLET',
    targetWallet: normalizedWallet,
    data: { reason },
    performedBy: adminWallet,
    performedAt: Timestamp.now(),
  });

  console.log(`🚫 Wallet blacklisted: ${normalizedWallet} by ${adminWallet}`);

  return { success: true, wallet: normalizedWallet };
});

/**
 * Remove a wallet from the blacklist
 */
export const removeFromBlacklist = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const { wallet, reason } = request.data as {
    wallet: string;
    reason?: string;
  };

  if (!wallet) {
    throw new HttpsError('invalid-argument', 'wallet is required');
  }

  const normalizedWallet = wallet.toLowerCase();

  await db.collection('airdrop_blacklist').doc(normalizedWallet).update({
    isActive: false,
    removedBy: adminWallet,
    removedAt: Timestamp.now(),
    removeReason: reason || 'Removed by admin',
  });

  await logAuditAction({
    action: 'REMOVE_FROM_BLACKLIST',
    targetWallet: normalizedWallet,
    data: { reason },
    performedBy: adminWallet,
    performedAt: Timestamp.now(),
  });

  console.log(`✅ Wallet removed from blacklist: ${normalizedWallet} by ${adminWallet}`);

  return { success: true, wallet: normalizedWallet };
});

/**
 * Get all blacklisted wallets
 */
export const getBlacklist = onCall({ cors: true }, async (request) => {
  verifyAdmin(request);

  const snapshot = await db.collection('airdrop_blacklist')
    .where('isActive', '==', true)
    .orderBy('blacklistedAt', 'desc')
    .get();

  const blacklist = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    blacklistedAt: doc.data().blacklistedAt?.toDate?.()?.toISOString(),
  }));

  return { blacklist };
});

/**
 * Whitelist a wallet (force include in airdrop)
 */
export const whitelistWallet = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const { wallet, tokenAmount, tier, reason } = request.data as {
    wallet: string;
    tokenAmount?: number;
    tier?: string;
    reason?: string;
  };

  if (!wallet) {
    throw new HttpsError('invalid-argument', 'wallet is required');
  }

  const normalizedWallet = wallet.toLowerCase();

  await db.collection('airdrop_whitelist').doc(normalizedWallet).set({
    wallet: normalizedWallet,
    tokenAmount: tokenAmount || null,
    tier: tier || null,
    reason: reason || 'Whitelisted by admin',
    whitelistedBy: adminWallet,
    whitelistedAt: Timestamp.now(),
    isActive: true,
  });

  await logAuditAction({
    action: 'WHITELIST_WALLET',
    targetWallet: normalizedWallet,
    data: { tokenAmount, tier, reason },
    performedBy: adminWallet,
    performedAt: Timestamp.now(),
  });

  console.log(`✅ Wallet whitelisted: ${normalizedWallet} by ${adminWallet}`);

  return { success: true, wallet: normalizedWallet };
});

/**
 * Remove a wallet from the whitelist
 */
export const removeFromWhitelist = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const { wallet } = request.data as { wallet: string };

  if (!wallet) {
    throw new HttpsError('invalid-argument', 'wallet is required');
  }

  const normalizedWallet = wallet.toLowerCase();

  await db.collection('airdrop_whitelist').doc(normalizedWallet).update({
    isActive: false,
    removedBy: adminWallet,
    removedAt: Timestamp.now(),
  });

  await logAuditAction({
    action: 'REMOVE_FROM_WHITELIST',
    targetWallet: normalizedWallet,
    performedBy: adminWallet,
    performedAt: Timestamp.now(),
  });

  return { success: true, wallet: normalizedWallet };
});

/**
 * Get all whitelisted wallets
 */
export const getWhitelist = onCall({ cors: true }, async (request) => {
  verifyAdmin(request);

  const snapshot = await db.collection('airdrop_whitelist')
    .where('isActive', '==', true)
    .orderBy('whitelistedAt', 'desc')
    .get();

  const whitelist = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    whitelistedAt: doc.data().whitelistedAt?.toDate?.()?.toISOString(),
  }));

  return { whitelist };
});

/**
 * Bulk override multiple allocations at once
 */
export const bulkOverrideAllocations = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const { overrides, reason } = request.data as {
    overrides: Array<{
      wallet: string;
      tokenAmount?: number;
      tier?: string;
      points?: number;
    }>;
    reason?: string;
  };

  if (!overrides || !Array.isArray(overrides) || overrides.length === 0) {
    throw new HttpsError('invalid-argument', 'overrides array is required');
  }

  if (overrides.length > 100) {
    throw new HttpsError('invalid-argument', 'Maximum 100 overrides per batch');
  }

  const config = await getAirdropConfig();
  const batch = db.batch();
  const results: Array<{ wallet: string; success: boolean; error?: string }> = [];

  for (const override of overrides) {
    try {
      const normalizedWallet = override.wallet.toLowerCase();

      const overrideData: Record<string, any> = {
        wallet: normalizedWallet,
        isOverride: true,
        overrideBy: adminWallet,
        overrideAt: Timestamp.now(),
        overrideReason: reason || 'Bulk override by admin',
      };

      if (override.tokenAmount !== undefined) {
        overrideData.tokenAmountFormatted = override.tokenAmount;
        overrideData.tokenAmount = (BigInt(override.tokenAmount) * BigInt(10 ** 18)).toString();
      }

      if (override.tier !== undefined) {
        overrideData.tier = override.tier;
      }

      if (override.points !== undefined) {
        overrideData.points = override.points;
      }

      batch.set(db.collection('allocation_overrides').doc(normalizedWallet), overrideData, { merge: true });

      if (config.snapshotId) {
        batch.set(
          db.collection('airdrops').doc(config.snapshotId).collection('allocations').doc(normalizedWallet),
          overrideData,
          { merge: true }
        );
      }

      results.push({ wallet: normalizedWallet, success: true });
    } catch (error: any) {
      results.push({ wallet: override.wallet, success: false, error: error.message });
    }
  }

  await batch.commit();

  await logAuditAction({
    action: 'BULK_OVERRIDE_ALLOCATIONS',
    data: { count: overrides.length, reason },
    performedBy: adminWallet,
    performedAt: Timestamp.now(),
  });

  console.log(`✅ Bulk override completed: ${results.filter(r => r.success).length}/${overrides.length} by ${adminWallet}`);

  return { success: true, results };
});

/**
 * Export all allocations to JSON
 */
export const exportAllocations = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const { snapshotId, format } = request.data as {
    snapshotId?: string;
    format?: 'json' | 'csv';
  };

  const config = await getAirdropConfig();
  const targetSnapshotId = snapshotId || config.snapshotId;

  if (!targetSnapshotId) {
    throw new HttpsError('not-found', 'No snapshot found');
  }

  const allocationsSnapshot = await db.collection('airdrops')
    .doc(targetSnapshotId)
    .collection('allocations')
    .get();

  const allocations = allocationsSnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      wallet: doc.id,
      tier: data.tier,
      points: data.points,
      tokenAmount: data.tokenAmountFormatted || 0,
      claimed: data.claimed || false,
      claimedAt: data.claimedAt?.toDate?.()?.toISOString() || null,
      isOverride: data.isOverride || false,
      isBlacklisted: data.isBlacklisted || false,
      isWhitelisted: data.isWhitelisted || false,
    };
  });

  await logAuditAction({
    action: 'EXPORT_ALLOCATIONS',
    data: { snapshotId: targetSnapshotId, format: format || 'json', count: allocations.length },
    performedBy: adminWallet,
    performedAt: Timestamp.now(),
  });

  if (format === 'csv') {
    const headers = ['wallet', 'tier', 'points', 'tokenAmount', 'claimed', 'claimedAt', 'isOverride', 'isBlacklisted', 'isWhitelisted'];
    const csvRows = [headers.join(',')];
    for (const alloc of allocations) {
      csvRows.push([
        alloc.wallet,
        alloc.tier,
        alloc.points,
        alloc.tokenAmount,
        alloc.claimed,
        alloc.claimedAt || '',
        alloc.isOverride,
        alloc.isBlacklisted,
        alloc.isWhitelisted,
      ].join(','));
    }
    return { format: 'csv', data: csvRows.join('\n'), count: allocations.length };
  }

  return { format: 'json', data: allocations, count: allocations.length };
});

/**
 * Recalculate a user's allocation based on current data
 */
export const recalculateUserAllocation = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const { wallet } = request.data as { wallet: string };

  if (!wallet) {
    throw new HttpsError('invalid-argument', 'wallet is required');
  }

  const normalizedWallet = wallet.toLowerCase();

  // Get user data
  const userDoc = await db.collection('users').doc(normalizedWallet).get();
  if (!userDoc.exists) {
    throw new HttpsError('not-found', 'User not found');
  }

  const userData = userDoc.data()!;

  // Get Discord activity
  const discordActivity = await db.collection('discord_activity')
    .where('walletAddress', '==', normalizedWallet)
    .get();

  let discordMessages = 0;
  for (const doc of discordActivity.docs) {
    discordMessages += doc.data().messageCount || 0;
  }

  // Get Telegram link
  const telegramLink = await db.collection('telegram_links')
    .where('walletAddress', '==', normalizedWallet)
    .get();

  const hasTelegram = !telegramLink.empty;

  // Get Zealy data
  const zealyUser = await db.collection('zealy_users')
    .where('walletAddress', '==', normalizedWallet)
    .get();

  let zealyXP = 0;
  if (!zealyUser.empty) {
    zealyXP = zealyUser.docs[0].data().xp || 0;
  }

  // Get staking data
  const stakingDoc = await db.collection('staking').doc(normalizedWallet).get();
  const stakingMultiplier = stakingDoc.exists ? (stakingDoc.data()?.multiplier || 1) : 1;

  // Calculate points (simplified - you'd use your actual calculation logic)
  const gamePoints = (userData.totalGamesPlayed || 0) * 10;
  const discordPoints = discordMessages * 2;
  const telegramPoints = hasTelegram ? 50 : 0;
  const zealyPoints = zealyXP;

  const basePoints = gamePoints + discordPoints + telegramPoints + zealyPoints;
  const totalPoints = Math.floor(basePoints * stakingMultiplier);

  // Determine tier
  let tier = 'common';
  if (totalPoints >= 10000) tier = 'legendary';
  else if (totalPoints >= 5000) tier = 'epic';
  else if (totalPoints >= 1000) tier = 'rare';

  const recalculation = {
    wallet: normalizedWallet,
    points: totalPoints,
    tier,
    breakdown: {
      gamePoints,
      discordPoints,
      telegramPoints,
      zealyPoints,
      stakingMultiplier,
    },
    recalculatedBy: adminWallet,
    recalculatedAt: Timestamp.now(),
  };

  // Store recalculation result
  await db.collection('allocation_recalculations').doc(normalizedWallet).set(recalculation);

  await logAuditAction({
    action: 'RECALCULATE_USER_ALLOCATION',
    targetWallet: normalizedWallet,
    data: recalculation,
    performedBy: adminWallet,
    performedAt: Timestamp.now(),
  });

  console.log(`🔄 Recalculated allocation for ${normalizedWallet}: ${totalPoints} points, ${tier} tier`);

  return { success: true, recalculation };
});

/**
 * Get claim status for all allocations
 */
export const getClaimStatus = onCall({ cors: true }, async (request) => {
  verifyAdmin(request);

  const { snapshotId, filter } = request.data as {
    snapshotId?: string;
    filter?: 'claimed' | 'unclaimed' | 'all';
  };

  const config = await getAirdropConfig();
  const targetSnapshotId = snapshotId || config.snapshotId;

  if (!targetSnapshotId) {
    throw new HttpsError('not-found', 'No snapshot found');
  }

  let query: FirebaseFirestore.Query = db.collection('airdrops')
    .doc(targetSnapshotId)
    .collection('allocations');

  if (filter === 'claimed') {
    query = query.where('claimed', '==', true);
  } else if (filter === 'unclaimed') {
    query = query.where('claimed', '==', false);
  }

  const snapshot = await query.limit(1000).get();

  const claims = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      wallet: doc.id,
      tier: data.tier,
      tokenAmount: data.tokenAmountFormatted || 0,
      claimed: data.claimed || false,
      claimedAt: data.claimedAt?.toDate?.()?.toISOString() || null,
      claimTxHash: data.claimTxHash || null,
    };
  });

  const claimedCount = claims.filter(c => c.claimed).length;
  const unclaimedCount = claims.filter(c => !c.claimed).length;

  return {
    claims,
    stats: {
      total: claims.length,
      claimed: claimedCount,
      unclaimed: unclaimedCount,
      claimRate: claims.length > 0 ? ((claimedCount / claims.length) * 100).toFixed(2) + '%' : '0%',
    },
  };
});

/**
 * Create a snapshot backup before major changes
 */
export const createSnapshotBackup = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const { snapshotId, description } = request.data as {
    snapshotId?: string;
    description?: string;
  };

  const config = await getAirdropConfig();
  const targetSnapshotId = snapshotId || config.snapshotId;

  if (!targetSnapshotId) {
    throw new HttpsError('not-found', 'No snapshot to backup');
  }

  const backupId = `backup_${targetSnapshotId}_${Date.now()}`;

  // Copy all allocations to backup
  const allocationsSnapshot = await db.collection('airdrops')
    .doc(targetSnapshotId)
    .collection('allocations')
    .get();

  const batch = db.batch();
  let count = 0;

  for (const doc of allocationsSnapshot.docs) {
    batch.set(
      db.collection('airdrop_backups').doc(backupId).collection('allocations').doc(doc.id),
      doc.data()
    );
    count++;

    // Firestore batches have a limit of 500 operations
    if (count % 400 === 0) {
      await batch.commit();
    }
  }

  await batch.commit();

  // Store backup metadata
  await db.collection('airdrop_backups').doc(backupId).set({
    id: backupId,
    sourceSnapshotId: targetSnapshotId,
    description: description || 'Snapshot backup',
    allocationCount: allocationsSnapshot.size,
    createdBy: adminWallet,
    createdAt: Timestamp.now(),
  });

  await logAuditAction({
    action: 'CREATE_SNAPSHOT_BACKUP',
    data: { backupId, sourceSnapshotId: targetSnapshotId, count: allocationsSnapshot.size },
    performedBy: adminWallet,
    performedAt: Timestamp.now(),
  });

  console.log(`📦 Snapshot backup created: ${backupId} with ${allocationsSnapshot.size} allocations`);

  return { success: true, backupId, count: allocationsSnapshot.size };
});

/**
 * Restore a snapshot from backup
 */
export const restoreFromBackup = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const { backupId, targetSnapshotId } = request.data as {
    backupId: string;
    targetSnapshotId?: string;
  };

  if (!backupId) {
    throw new HttpsError('invalid-argument', 'backupId is required');
  }

  // Get backup metadata
  const backupDoc = await db.collection('airdrop_backups').doc(backupId).get();
  if (!backupDoc.exists) {
    throw new HttpsError('not-found', 'Backup not found');
  }

  const config = await getAirdropConfig();
  const restoreToId = targetSnapshotId || config.snapshotId;

  if (!restoreToId) {
    throw new HttpsError('invalid-argument', 'No target snapshot specified');
  }

  // Get backup allocations
  const backupAllocations = await db.collection('airdrop_backups')
    .doc(backupId)
    .collection('allocations')
    .get();

  // Delete current allocations
  const currentAllocations = await db.collection('airdrops')
    .doc(restoreToId)
    .collection('allocations')
    .get();

  let batch = db.batch();
  let count = 0;

  for (const doc of currentAllocations.docs) {
    batch.delete(doc.ref);
    count++;
    if (count % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  await batch.commit();

  // Restore from backup
  batch = db.batch();
  count = 0;

  for (const doc of backupAllocations.docs) {
    batch.set(
      db.collection('airdrops').doc(restoreToId).collection('allocations').doc(doc.id),
      {
        ...doc.data(),
        restoredFromBackup: backupId,
        restoredAt: Timestamp.now(),
      }
    );
    count++;
    if (count % 400 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  await batch.commit();

  await logAuditAction({
    action: 'RESTORE_FROM_BACKUP',
    data: { backupId, targetSnapshotId: restoreToId, count: backupAllocations.size },
    performedBy: adminWallet,
    performedAt: Timestamp.now(),
  });

  console.log(`🔄 Restored from backup: ${backupId} to ${restoreToId}`);

  return { success: true, restoredCount: backupAllocations.size };
});

/**
 * Get list of available backups
 */
export const getBackups = onCall({ cors: true }, async (request) => {
  verifyAdmin(request);

  const snapshot = await db.collection('airdrop_backups')
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  const backups = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      sourceSnapshotId: data.sourceSnapshotId,
      description: data.description,
      allocationCount: data.allocationCount,
      createdBy: data.createdBy,
      createdAt: data.createdAt?.toDate?.()?.toISOString(),
    };
  });

  return { backups };
});

/**
 * Get tier configuration
 */
export const getTierConfig = onCall({ cors: true }, async (request) => {
  verifyAdmin(request);

  const configDoc = await db.collection('airdrop_tier_config').doc('current').get();

  if (!configDoc.exists) {
    // Return default tier config
    const defaultConfig: TierConfig[] = [
      { name: 'legendary', minPoints: 10000, maxPoints: Infinity, poolPercentage: 40 },
      { name: 'epic', minPoints: 5000, maxPoints: 9999, poolPercentage: 30 },
      { name: 'rare', minPoints: 1000, maxPoints: 4999, poolPercentage: 20 },
      { name: 'common', minPoints: 0, maxPoints: 999, poolPercentage: 10 },
    ];
    return { tiers: defaultConfig };
  }

  return { tiers: configDoc.data()!.tiers as TierConfig[] };
});

/**
 * Update tier configuration
 */
export const updateTierConfig = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const { tiers } = request.data as { tiers: TierConfig[] };

  if (!tiers || !Array.isArray(tiers) || tiers.length === 0) {
    throw new HttpsError('invalid-argument', 'tiers array is required');
  }

  // Validate pool percentages add up to 100
  const totalPercentage = tiers.reduce((sum, t) => sum + t.poolPercentage, 0);
  if (totalPercentage !== 100) {
    throw new HttpsError('invalid-argument', `Pool percentages must add up to 100, got ${totalPercentage}`);
  }

  // Store previous config for rollback
  const previousConfig = await db.collection('airdrop_tier_config').doc('current').get();
  if (previousConfig.exists) {
    await db.collection('airdrop_tier_config_history').add({
      ...previousConfig.data(),
      archivedAt: Timestamp.now(),
      archivedBy: adminWallet,
    });
  }

  await db.collection('airdrop_tier_config').doc('current').set({
    tiers,
    updatedBy: adminWallet,
    updatedAt: Timestamp.now(),
  });

  await logAuditAction({
    action: 'UPDATE_TIER_CONFIG',
    data: { tiers },
    performedBy: adminWallet,
    performedAt: Timestamp.now(),
  });

  console.log(`⚙️ Tier config updated by ${adminWallet}`);

  return { success: true, tiers };
});

/**
 * Get audit log
 */
export const getAuditLog = onCall({ cors: true }, async (request) => {
  verifyAdmin(request);

  const { limit: queryLimit, action, wallet } = request.data as {
    limit?: number;
    action?: string;
    wallet?: string;
  };

  let query: FirebaseFirestore.Query = db.collection('airdrop_audit_log')
    .orderBy('performedAt', 'desc');

  if (action) {
    query = query.where('action', '==', action);
  }

  if (wallet) {
    query = query.where('targetWallet', '==', wallet.toLowerCase());
  }

  const snapshot = await query.limit(queryLimit || 100).get();

  const logs = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    performedAt: doc.data().performedAt?.toDate?.()?.toISOString(),
  }));

  return { logs };
});

/**
 * Emergency pause - immediately stops all airdrop claims
 */
export const emergencyPause = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const { reason } = request.data as { reason?: string };

  const configRef = db.collection('airdrop_config').doc('current');

  await configRef.set({
    emergencyPaused: true,
    emergencyPausedAt: Timestamp.now(),
    emergencyPausedBy: adminWallet,
    emergencyPauseReason: reason || 'Emergency pause by admin',
    isPaused: true,
    pausedAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    updatedBy: adminWallet,
  }, { merge: true });

  await logAuditAction({
    action: 'EMERGENCY_PAUSE',
    data: { reason },
    performedBy: adminWallet,
    performedAt: Timestamp.now(),
  });

  console.log(`🚨 EMERGENCY PAUSE activated by ${adminWallet}. Reason: ${reason || 'Not specified'}`);

  return { success: true, message: 'Emergency pause activated' };
});

/**
 * Lift emergency pause
 */
export const liftEmergencyPause = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const configRef = db.collection('airdrop_config').doc('current');
  const config = await getAirdropConfig();

  if (!config.emergencyPaused) {
    throw new HttpsError('failed-precondition', 'Emergency pause is not active');
  }

  await configRef.set({
    emergencyPaused: false,
    emergencyLiftedAt: Timestamp.now(),
    emergencyLiftedBy: adminWallet,
    isPaused: false,
    pausedAt: null,
    updatedAt: Timestamp.now(),
    updatedBy: adminWallet,
  }, { merge: true });

  await logAuditAction({
    action: 'LIFT_EMERGENCY_PAUSE',
    performedBy: adminWallet,
    performedAt: Timestamp.now(),
  });

  console.log(`✅ Emergency pause lifted by ${adminWallet}`);

  return { success: true, message: 'Emergency pause lifted' };
});

/**
 * Get system version and check for migrations
 */
export const getSystemVersion = onCall({ cors: true }, async (request) => {
  verifyAdmin(request);

  const config = await getAirdropConfig();

  return {
    currentVersion: SYSTEM_VERSION,
    configVersion: config.version || '0.0.0',
    needsMigration: config.version !== SYSTEM_VERSION,
  };
});

/**
 * Run system migration (for upgrades)
 */
export const runMigration = onCall({ cors: true }, async (request) => {
  const adminWallet = verifyAdmin(request);

  const config = await getAirdropConfig();

  if (config.version === SYSTEM_VERSION) {
    return { success: true, message: 'Already at latest version', version: SYSTEM_VERSION };
  }

  // Run migrations based on version
  const migrations: Record<string, () => Promise<void>> = {
    '1.0.0': async () => {
      // Migration to v1.0.0
      // Add version and emergency fields to config
      await db.collection('airdrop_config').doc('current').set({
        version: '1.0.0',
        emergencyPaused: false,
      }, { merge: true });
    },
  };

  const configVersion = config.version || '0.0.0';
  const versionsToMigrate = Object.keys(migrations).filter(v => v > configVersion);

  for (const version of versionsToMigrate.sort()) {
    console.log(`🔄 Running migration to v${version}`);
    await migrations[version]();
  }

  // Update version
  await db.collection('airdrop_config').doc('current').set({
    version: SYSTEM_VERSION,
    lastMigrationAt: Timestamp.now(),
    lastMigrationBy: adminWallet,
  }, { merge: true });

  await logAuditAction({
    action: 'RUN_MIGRATION',
    data: { fromVersion: configVersion, toVersion: SYSTEM_VERSION },
    performedBy: adminWallet,
    performedAt: Timestamp.now(),
  });

  console.log(`✅ Migration complete: ${configVersion} -> ${SYSTEM_VERSION}`);

  return { success: true, fromVersion: configVersion, toVersion: SYSTEM_VERSION };
});
