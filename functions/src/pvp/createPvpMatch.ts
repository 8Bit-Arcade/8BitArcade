import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { PvpMatch, PvpRound } from './pvpTypes';

const db = admin.firestore();

const VALID_GAME_IDS = [
  'space-rocks', 'alien-assault', 'brick-breaker', 'pixel-snake',
  'bug-blaster', 'chomper', 'flappy-bird', 'galaxy-fighter',
  'road-hopper', 'missile-command', 'block-drop', 'paddle-battle',
];

/**
 * createPvpMatch — creates a new PvP challenge in Firestore.
 * Token escrow (for paid matches) is handled on-chain before calling this.
 * For free matches (betAmount == 0), no on-chain interaction needed.
 */
export const createPvpMatch = onCall({ memory: '128MiB', maxInstances: 10 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { betAmount, gameIds, numGames, onChainMatchId, txHashCreate } = request.data;
  const creator = request.auth.uid.toLowerCase();

  // ── Validation ─────────────────────────────────────────────────────────
  if (typeof betAmount !== 'number' || betAmount < 0) {
    throw new HttpsError('invalid-argument', 'Invalid betAmount');
  }
  if (!Array.isArray(gameIds) || gameIds.length === 0) {
    throw new HttpsError('invalid-argument', 'At least one game required');
  }
  for (const gid of gameIds) {
    if (!VALID_GAME_IDS.includes(gid)) {
      throw new HttpsError('invalid-argument', `Invalid gameId: ${gid}`);
    }
  }
  const resolvedNumGames = typeof numGames === 'number' && numGames >= 1 ? numGames : gameIds.length;

  // ── Check user is not banned ────────────────────────────────────────────
  const userDoc = await db.collection('users').doc(creator).get();
  if (userDoc.exists && userDoc.data()?.isBanned) {
    throw new HttpsError('permission-denied', 'Account is banned');
  }

  // ── Assign sequential display number ───────────────────────────────────
  const counterRef = db.collection('config').doc('pvpCounter');
  const displayNumber: number = await db.runTransaction(async (txn) => {
    const snap = await txn.get(counterRef);
    const current = snap.exists ? (snap.data()?.pvpCount || 0) : 0;
    const next = current + 1;
    txn.set(counterRef, { pvpCount: next }, { merge: true });
    return next;
  });

  const matchId = `PVP-${String(displayNumber).padStart(4, '0')}`;
  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(now.toMillis() + 60 * 60 * 1000);

  // Build empty rounds from gameIds (cycling if numGames > gameIds.length)
  const rounds: PvpRound[] = Array.from({ length: resolvedNumGames }, (_, i) => ({
    roundIndex: i,
    gameId: gameIds[i % gameIds.length],
    creatorScore: null,
    challengerScore: null,
    creatorFinished: false,
    challengerFinished: false,
    winner: null,
    startedAt: null,
    completedAt: null,
  }));

  const match: PvpMatch = {
    id: matchId,
    displayNumber,
    creator,
    challenger: null,
    status: 'open',
    betAmount,
    gameIds,
    numGames: resolvedNumGames,
    rounds,
    creatorTotalScore: 0,
    challengerTotalScore: 0,
    winner: null,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    expiresAt,
    onChainMatchId: onChainMatchId || null,
    txHashCreate: txHashCreate || null,
    txHashJoin: null,
    txHashResolve: null,
  };

  await db.collection('pvpMatches').doc(matchId).set(match);

  return { matchId, displayNumber };
});
