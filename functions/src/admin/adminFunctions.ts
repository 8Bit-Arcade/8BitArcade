import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { unbanAccount as unbanAccountInternal, clearFlags as clearFlagsInternal, getFlaggedAccounts } from '../anticheat/flagging';
import { collections, db } from '../config/firebase';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

/**
 * Admin wallet addresses (lowercase)
 * TODO: Move to environment config or Firestore admin collection
 */
const ADMIN_ADDRESSES = [
  '0x92f5523c2329ee281e7feb8808fce4b49ab1ebf8', // 8BitToken owner wallet
  // Add more admin addresses here as needed
];

/**
 * Check if the authenticated user is an admin
 */
async function isAdmin(uid: string | undefined): Promise<boolean> {
  if (!uid) return false;

  const address = uid.toLowerCase();

  // Check hardcoded admin list
  if (ADMIN_ADDRESSES.includes(address)) {
    return true;
  }

  // Check Firestore for admin role
  const userDoc = await collections.users.doc(address).get();
  return userDoc.data()?.isAdmin === true;
}

/**
 * Unban a user account (admin only)
 */
export const unbanAccount = onCall<{ playerId: string }, Promise<{ success: boolean; message: string }>>(async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    // Verify admin privileges
    if (!(await isAdmin(request.auth.uid))) {
      throw new HttpsError('permission-denied', 'Admin privileges required');
    }

    const { playerId } = request.data;

    if (!playerId) {
      throw new HttpsError('invalid-argument', 'Player ID is required');
    }

    try {
      const normalizedPlayerId = playerId.toLowerCase();
      await unbanAccountInternal(normalizedPlayerId);

      console.log(`Admin ${request.auth.uid} unbanned user ${normalizedPlayerId}`);

      return {
        success: true,
        message: `Successfully unbanned user ${normalizedPlayerId}`,
      };
    } catch (error: any) {
      console.error('Error unbanning account:', error);
      throw new HttpsError('internal', `Failed to unban account: ${error.message}`);
    }
  }
);

/**
 * Clear flags from a user account (admin only)
 */
export const clearUserFlags = onCall<{ playerId: string }, Promise<{ success: boolean; message: string }>>(async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    // Verify admin privileges
    if (!(await isAdmin(request.auth.uid))) {
      throw new HttpsError('permission-denied', 'Admin privileges required');
    }

    const { playerId } = request.data;

    if (!playerId) {
      throw new HttpsError('invalid-argument', 'Player ID is required');
    }

    try {
      const normalizedPlayerId = playerId.toLowerCase();
      await clearFlagsInternal(normalizedPlayerId);

      console.log(`Admin ${request.auth.uid} cleared flags for user ${normalizedPlayerId}`);

      return {
        success: true,
        message: `Successfully cleared flags for user ${normalizedPlayerId}`,
      };
    } catch (error: any) {
      console.error('Error clearing flags:', error);
      throw new HttpsError('internal', `Failed to clear flags: ${error.message}`);
    }
  }
);

/**
 * Get list of flagged accounts (admin only)
 */
export const getFlaggedUsers = onCall<{ limit?: number }, Promise<any[]>>(async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    // Verify admin privileges
    if (!(await isAdmin(request.auth.uid))) {
      throw new HttpsError('permission-denied', 'Admin privileges required');
    }

    const { limit = 50 } = request.data;

    try {
      const flaggedAccounts = await getFlaggedAccounts(Math.min(limit, 100));

      console.log(`Admin ${request.auth.uid} requested flagged users list`);

      return flaggedAccounts;
    } catch (error: any) {
      console.error('Error getting flagged accounts:', error);
      throw new HttpsError('internal', `Failed to get flagged accounts: ${error.message}`);
    }
  }
);

/**
 * Get user ban status and flags (admin only)
 */
export const getUserBanInfo = onCall<{ playerId: string }, Promise<any>>(async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    // Verify admin privileges
    if (!(await isAdmin(request.auth.uid))) {
      throw new HttpsError('permission-denied', 'Admin privileges required');
    }

    const { playerId } = request.data;

    if (!playerId) {
      throw new HttpsError('invalid-argument', 'Player ID is required');
    }

    try {
      const normalizedPlayerId = playerId.toLowerCase();
      const userDoc = await collections.users.doc(normalizedPlayerId).get();

      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'User not found');
      }

      const userData = userDoc.data();

      return {
        playerId: normalizedPlayerId,
        isBanned: userData?.isBanned || false,
        banReason: userData?.banReason || null,
        bannedAt: userData?.bannedAt || null,
        flags: userData?.flags || { count: 0, reasons: [] },
      };
    } catch (error: any) {
      if (error instanceof HttpsError) throw error;
      console.error('Error getting user ban info:', error);
      throw new HttpsError('internal', `Failed to get user ban info: ${error.message}`);
    }
  }
);

/**
 * Seed test tournament entries (admin only)
 * Creates fake entries with scores for testing the leaderboard
 */
export const seedTournamentEntries = onCall<{
  tournamentId: string;
  entries: Array<{ address: string; score: number; username?: string }>;
}, Promise<{ success: boolean; message: string; created: number }>>(async (request) => {
  // Verify authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  // Verify admin privileges
  if (!(await isAdmin(request.auth.uid))) {
    throw new HttpsError('permission-denied', 'Admin privileges required');
  }

  const { tournamentId, entries } = request.data;

  if (!tournamentId || !entries || !Array.isArray(entries)) {
    throw new HttpsError('invalid-argument', 'Tournament ID and entries array required');
  }

  try {
    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {
      throw new HttpsError('not-found', 'Tournament not found');
    }

    const now = Timestamp.now();
    const batch = db.batch();
    let createdCount = 0;

    for (const entry of entries) {
      const playerAddress = entry.address.toLowerCase();
      const entryRef = tournamentRef.collection('entries').doc(playerAddress);

      // Create entry document
      batch.set(entryRef, {
        tournamentId,
        player: playerAddress,
        enteredAt: now,
        bestScore: entry.score || 0,
        lastPlayedAt: now,
        totalPlays: Math.floor(Math.random() * 10) + 1,
        paid: true,
        txHash: `0x${'test'.repeat(16)}${createdCount}`,
      }, { merge: true });

      // Create leaderboard record
      const leaderboardRef = tournamentRef.collection('leaderboard').doc(playerAddress);
      batch.set(leaderboardRef, {
        address: playerAddress,
        score: entry.score || 0,
        joinedAt: now,
        hasPaid: true,
        lastUpdated: now,
      }, { merge: true });

      // Create user if doesn't exist
      const userRef = collections.users.doc(playerAddress);
      batch.set(userRef, {
        address: playerAddress,
        username: entry.username || `Player${createdCount + 1}`,
        createdAt: now,
        lastSeen: now,
      }, { merge: true });

      createdCount++;
    }

    // Update tournament participant count
    batch.update(tournamentRef, {
      totalEntries: FieldValue.increment(entries.length),
      updatedAt: now,
    });

    await batch.commit();

    console.log(`Admin ${request.auth.uid} seeded ${createdCount} entries for tournament ${tournamentId}`);

    return {
      success: true,
      message: `Successfully created ${createdCount} test entries`,
      created: createdCount,
    };
  } catch (error: any) {
    if (error instanceof HttpsError) throw error;
    console.error('Error seeding tournament entries:', error);
    throw new HttpsError('internal', `Failed to seed entries: ${error.message}`);
  }
});
