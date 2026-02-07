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
