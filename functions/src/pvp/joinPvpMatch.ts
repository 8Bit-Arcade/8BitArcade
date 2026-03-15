import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * joinPvpMatch — challenger joins an open PvP match.
 * For paid matches, the on-chain escrow joinMatch() tx MUST be submitted
 * and confirmed before calling this. Pass the txHash to record it.
 */
export const joinPvpMatch = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

  const { matchId, txHashJoin } = data;
  const challenger = context.auth.uid.toLowerCase();

  if (!matchId || typeof matchId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'matchId required');
  }

  // ── Ban check ───────────────────────────────────────────────────────────
  const userDoc = await db.collection('users').doc(challenger).get();
  if (userDoc.exists && userDoc.data()?.isBanned) {
    throw new functions.https.HttpsError('permission-denied', 'Account is banned');
  }

  const matchRef = db.collection('pvpMatches').doc(matchId);

  const result = await db.runTransaction(async (txn) => {
    const snap = await txn.get(matchRef);
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Match not found');

    const match = snap.data()!;
    if (match.status !== 'open') {
      throw new functions.https.HttpsError('failed-precondition', 'Match is not open');
    }
    if (match.challenger) {
      throw new functions.https.HttpsError('failed-precondition', 'Match already has a challenger');
    }
    if (match.creator === challenger) {
      throw new functions.https.HttpsError('invalid-argument', 'Cannot join your own match');
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
