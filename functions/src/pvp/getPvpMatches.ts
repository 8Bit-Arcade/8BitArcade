import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * getPvpMatches — returns open/active/recent matches for the lobby.
 * Scores are HIDDEN in open/active matches (opponent cannot see them).
 */
export const getPvpMatches = functions.https.onCall(async (data, context) => {
  const { status, limit: rawLimit, playerAddress } = data || {};
  const requestingPlayer = context.auth?.uid?.toLowerCase() || null;
  const pageLimit = Math.min(rawLimit || 50, 100);

  let query: admin.firestore.Query = db.collection('pvpMatches');

  if (status && ['open', 'active', 'completed', 'cancelled'].includes(status)) {
    query = query.where('status', '==', status);
  } else {
    // Default: open + active for lobby
    // Firestore doesn't support OR queries on the same field easily, so we fetch both
  }

  if (playerAddress) {
    // Not directly queryable with OR, handled client-side or via two queries
  }

  const snap = await query
    .orderBy('createdAt', 'desc')
    .limit(pageLimit)
    .get();

  const matches = snap.docs.map(doc => {
    const m = doc.data();

    // Mask scores for active/open matches unless requesting player is a participant
    const isParticipant = requestingPlayer &&
      (m.creator === requestingPlayer || m.challenger === requestingPlayer);

    const sanitizedRounds = m.rounds?.map((r: any) => {
      if (isParticipant || m.status === 'completed') return r;
      // Hide both scores from spectators during active play
      return {
        ...r,
        creatorScore: r.creatorFinished && r.challengerFinished ? r.creatorScore : null,
        challengerScore: r.creatorFinished && r.challengerFinished ? r.challengerScore : null,
      };
    }) || [];

    return {
      ...m,
      rounds: sanitizedRounds,
      // Never expose on-chain match ID to non-participants
      onChainMatchId: isParticipant ? m.onChainMatchId : null,
    };
  });

  return { matches };
});

/**
 * getPvpMatch — returns a single match by ID (with score reveal rules).
 */
export const getPvpMatch = functions.https.onCall(async (data, context) => {
  const { matchId } = data;
  if (!matchId) throw new functions.https.HttpsError('invalid-argument', 'matchId required');

  const requestingPlayer = context.auth?.uid?.toLowerCase() || null;
  const snap = await db.collection('pvpMatches').doc(matchId).get();

  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Match not found');

  const m = snap.data()!;
  const isParticipant = requestingPlayer &&
    (m.creator === requestingPlayer || m.challenger === requestingPlayer);

  const sanitizedRounds = m.rounds?.map((r: any) => {
    if (isParticipant || m.status === 'completed') return r;
    return {
      ...r,
      creatorScore: r.creatorFinished && r.challengerFinished ? r.creatorScore : null,
      challengerScore: r.creatorFinished && r.challengerFinished ? r.challengerScore : null,
    };
  }) || [];

  return { ...m, rounds: sanitizedRounds };
});

/**
 * cancelPvpMatch — creator cancels their open match.
 */
export const cancelPvpMatch = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

  const { matchId } = data;
  const player = context.auth.uid.toLowerCase();

  const matchRef = db.collection('pvpMatches').doc(matchId);
  await db.runTransaction(async (txn) => {
    const snap = await txn.get(matchRef);
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Match not found');

    const m = snap.data()!;
    if (m.status !== 'open') {
      throw new functions.https.HttpsError('failed-precondition', 'Can only cancel open matches');
    }
    if (m.creator !== player) {
      throw new functions.https.HttpsError('permission-denied', 'Only creator can cancel');
    }

    txn.update(matchRef, {
      status: 'cancelled',
      completedAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    });
  });

  return { success: true };
});

/**
 * cancelExpiredPvpMatches — scheduled function that cancels matches older than 1hr with no challenger.
 */
export const cancelExpiredPvpMatches = functions.pubsub
  .schedule('every 15 minutes')
  .onRun(async () => {
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
    const snap = await db.collection('pvpMatches')
      .where('status', '==', 'open')
      .where('createdAt', '<', cutoff)
      .get();

    if (snap.empty) return;

    const batch = db.batch();
    const now = admin.firestore.Timestamp.now();
    snap.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'cancelled',
        completedAt: now,
        updatedAt: now,
      });
    });

    await batch.commit();
    console.log(`Cancelled ${snap.size} expired PvP matches`);
  });
