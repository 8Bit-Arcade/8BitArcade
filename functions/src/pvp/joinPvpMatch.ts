import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * joinPvpMatch — challenger joins an open PvP match.
 * For paid matches, the on-chain escrow joinMatch() tx MUST be submitted
 * and confirmed before calling this. Pass the txHash to record it.
 */
export const joinPvpMatch = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { matchId, txHashJoin } = request.data;
  const challenger = request.auth.uid.toLowerCase();

  if (!matchId || typeof matchId !== 'string') {
    throw new HttpsError('invalid-argument', 'matchId required');
  }

  // ── Ban check ───────────────────────────────────────────────────────────
  const userDoc = await db.collection('users').doc(challenger).get();
  if (userDoc.exists && userDoc.data()?.isBanned) {
    throw new HttpsError('permission-denied', 'Account is banned');
  }

  const matchRef = db.collection('pvpMatches').doc(matchId);

  const result = await db.runTransaction(async (txn) => {
    const snap = await txn.get(matchRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Match not found');

    const match = snap.data()!;
    if (match.status !== 'open') {
      throw new HttpsError('failed-precondition', 'Match is not open');
    }
    if (match.challenger) {
      throw new HttpsError('failed-precondition', 'Match already has a challenger');
    }
    if (match.creator === challenger) {
      throw new HttpsError('invalid-argument', 'Cannot join your own match');
    }

    const now = admin.firestore.Timestamp.now();
    txn.update(matchRef, {
      challenger,
      status: 'active',
      startedAt: now,
      txHashJoin: txHashJoin || null,
      updatedAt: now,
    });

    return { creator: match.creator, betAmount: match.betAmount };
  });

  return { success: true, ...result };
});
