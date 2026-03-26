import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import {
  BracketTournament, BracketSize, PrizeStructure,
  VALID_BRACKET_SIZES, BracketMatch,
} from '../pvp/pvpTypes';
import {
  nextBracketSize, generateSingleEliminationBracket,
  propagateWinner, computePrize, PRIZE_STRUCTURES,
} from './bracketUtils';

const db = admin.firestore();

const VALID_GAME_IDS = [
  'space-rocks', 'alien-assault', 'brick-breaker', 'pixel-snake',
  'bug-blaster', 'chomper', 'flappy-bird', 'galaxy-fighter',
  'road-hopper', 'missile-command', 'block-drop', 'paddle-battle',
];

// ─── Admin: Create Bracket Tournament ─────────────────────────────────────

export const createBracketTournament = onCall({ memory: '128MiB', maxInstances: 5 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const {
    name, description, format, gameIds, gameScope,
    maxParticipants, entryFee, prizePool, prizeStructure,
    burnPercentage, registrationStart, registrationEnd,
    startTime, endTime, roundDurationMinutes, seeding, visibility,
  } = request.data;

  // ── Assign display number ───────────────────────────────────────────────
  const counterRef = db.collection('config').doc('bracketCounter');
  const displayNumber: number = await db.runTransaction(async (txn) => {
    const snap = await txn.get(counterRef);
    const current = snap.exists ? (snap.data()?.bracketCount || 0) : 0;
    const next = current + 1;
    txn.set(counterRef, { bracketCount: next }, { merge: true });
    return next;
  });

  const tournamentId = `BRKT-${String(displayNumber).padStart(3, '0')}`;
  const now = admin.firestore.Timestamp.now();

  // Validate maxParticipants
  const validSize = VALID_BRACKET_SIZES.includes(maxParticipants as BracketSize)
    ? maxParticipants as BracketSize
    : nextBracketSize(maxParticipants || 8);

  // Validate prize structure sums to 100
  const structure: PrizeStructure = prizeStructure || PRIZE_STRUCTURES.standard;
  const pctSum = Object.values(structure).reduce((a: number, b: unknown) => a + (b as number), 0);
  if (Math.abs(pctSum - 100) > 0.01) {
    throw new HttpsError('invalid-argument', 'Prize structure must sum to 100%');
  }

  const validatedGameIds: string[] = gameScope === 'all'
    ? VALID_GAME_IDS
    : (gameIds || []).filter((g: string) => VALID_GAME_IDS.includes(g));

  if (validatedGameIds.length === 0) {
    throw new HttpsError('invalid-argument', 'At least one valid game required');
  }

  const tournament: BracketTournament = {
    id: tournamentId,
    displayNumber,
    name: name || `Tournament #${displayNumber}`,
    description: description || '',
    format: format || 'single',
    status: 'registration',
    gameIds: validatedGameIds,
    gameScope: gameScope || 'single',
    maxParticipants: validSize,
    entryFee: entryFee || 0,
    prizePool: prizePool || 0,
    prizeStructure: structure,
    burnPercentage: burnPercentage ?? 50,
    participants: [],
    registrationStart: registrationStart
      ? admin.firestore.Timestamp.fromMillis(registrationStart)
      : now,
    registrationEnd: registrationEnd
      ? admin.firestore.Timestamp.fromMillis(registrationEnd)
      : admin.firestore.Timestamp.fromMillis(now.toMillis() + 48 * 3600 * 1000),
    startTime: startTime ? admin.firestore.Timestamp.fromMillis(startTime) : null,
    endTime: endTime ? admin.firestore.Timestamp.fromMillis(endTime) : null,
    roundDurationMinutes: roundDurationMinutes || 60,
    seeding: seeding || 'random',
    visibility: visibility || 'public',
    createdAt: now,
    updatedAt: now,
    createdBy: request.auth.uid.toLowerCase(),
    completedAt: null,
    winnerId: null,
    rounds: [], // generated on startBracketTournament
  };

  await db.collection('bracketTournaments').doc(tournamentId).set(tournament);

  return { tournamentId, displayNumber };
});

// ─── Player: Join Bracket Tournament ──────────────────────────────────────

export const joinBracketTournament = onCall({ memory: '128MiB', maxInstances: 10 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { tournamentId } = request.data;
  const player = request.auth.uid.toLowerCase();

  const ref = db.collection('bracketTournaments').doc(tournamentId);

  await db.runTransaction(async (txn) => {
    const snap = await txn.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Tournament not found');

    const t = snap.data() as BracketTournament;

    if (t.status !== 'registration') {
      throw new HttpsError('failed-precondition', 'Registration is closed');
    }

    const now = admin.firestore.Timestamp.now();
    if (now.toMillis() < t.registrationStart.toMillis()) {
      throw new HttpsError('failed-precondition', 'Registration not open yet');
    }
    if (now.toMillis() > t.registrationEnd.toMillis()) {
      throw new HttpsError('failed-precondition', 'Registration has closed');
    }
    if (t.participants.includes(player)) {
      throw new HttpsError('already-exists', 'Already registered');
    }
    if (t.participants.length >= t.maxParticipants) {
      throw new HttpsError('resource-exhausted', 'Tournament is full');
    }

    // Write participant sub-doc
    const participantRef = ref.collection('participants').doc(player);
    txn.set(participantRef, {
      address: player,
      displayName: '',
      joinedAt: now,
      seed: 0,
      currentRound: 0,
      isEliminated: false,
      eliminatedRound: null,
      totalEarnings: 0,
      matchHistory: [],
    });

    txn.update(ref, {
      participants: admin.firestore.FieldValue.arrayUnion(player),
      updatedAt: now,
    });
  });

  return { success: true };
});

// ─── Admin: Start Tournament (generate bracket) ────────────────────────────

export const startBracketTournament = onCall({ memory: '128MiB', maxInstances: 5 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { tournamentId } = request.data;
  const ref = db.collection('bracketTournaments').doc(tournamentId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Tournament not found');

  const t = snap.data() as BracketTournament;
  if (t.status !== 'registration') {
    throw new HttpsError('failed-precondition', `Cannot start: status is ${t.status}`);
  }

  let participants = [...t.participants];
  if (participants.length < 2) {
    throw new HttpsError('failed-precondition', 'Need at least 2 participants to start');
  }

  // Seed participants
  if (t.seeding === 'random') {
    participants = participants.sort(() => Math.random() - 0.5);
  }

  const bracketSize = nextBracketSize(participants.length);
  const rounds = generateSingleEliminationBracket(
    participants, bracketSize, t.prizePool, t.prizeStructure
  );

  const now = admin.firestore.Timestamp.now();

  // Update participant seed numbers
  const batch = db.batch();
  participants.forEach((addr, idx) => {
    const pRef = ref.collection('participants').doc(addr);
    batch.set(pRef, { seed: idx + 1, updatedAt: now }, { merge: true });
  });

  batch.update(ref, {
    status: 'active',
    rounds,
    startTime: now,
    updatedAt: now,
  });

  await batch.commit();

  return { success: true, bracketSize, rounds: rounds.length };
});

// ─── Admin: Full Control Panel ─────────────────────────────────────────────

export const adminBracketControl = onCall({ memory: '128MiB', maxInstances: 3 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { tournamentId, action, updates } = request.data;
  const ref = db.collection('bracketTournaments').doc(tournamentId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Tournament not found');

  const t = snap.data() as BracketTournament;
  const now = admin.firestore.Timestamp.now();

  switch (action) {
    case 'pause':
      if (t.status !== 'active') throw new HttpsError('failed-precondition', 'Not active');
      await ref.update({ status: 'paused', updatedAt: now });
      break;

    case 'resume':
      if (t.status !== 'paused') throw new HttpsError('failed-precondition', 'Not paused');
      await ref.update({ status: 'active', updatedAt: now });
      break;

    case 'stop':
    case 'cancel':
      await ref.update({ status: 'cancelled', completedAt: now, updatedAt: now });
      break;

    case 'reset': {
      await ref.update({
        status: 'registration',
        rounds: [],
        participants: [],
        winnerId: null,
        startTime: null,
        completedAt: null,
        updatedAt: now,
      });
      const pSnap = await ref.collection('participants').get();
      const batch = db.batch();
      pSnap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      break;
    }

    case 'update': {
      if (!updates || typeof updates !== 'object') {
        throw new HttpsError('invalid-argument', 'updates object required');
      }
      const allowed = [
        'name', 'description', 'entryFee', 'prizePool', 'prizeStructure',
        'registrationStart', 'registrationEnd', 'startTime', 'endTime',
        'roundDurationMinutes', 'visibility', 'maxParticipants',
      ];
      const safeUpdates: any = { updatedAt: now };
      for (const key of allowed) {
        if (key in updates) {
          if (['registrationStart', 'registrationEnd', 'startTime', 'endTime'].includes(key) && updates[key]) {
            safeUpdates[key] = admin.firestore.Timestamp.fromMillis(updates[key]);
          } else {
            safeUpdates[key] = updates[key];
          }
        }
      }
      await ref.update(safeUpdates);
      break;
    }

    case 'extend_deadline': {
      const { newEndTime } = updates || {};
      if (!newEndTime) throw new HttpsError('invalid-argument', 'newEndTime required');
      await ref.update({
        endTime: admin.firestore.Timestamp.fromMillis(newEndTime),
        updatedAt: now,
      });
      break;
    }

    case 'force_advance_match': {
      const { roundIndex, matchIndex, winner: forceWinner } = updates || {};
      if (roundIndex == null || matchIndex == null || !forceWinner) {
        throw new HttpsError('invalid-argument', 'roundIndex, matchIndex, winner required');
      }
      await resolveMatchInBracket(tournamentId, roundIndex, matchIndex, forceWinner, true);
      break;
    }

    case 'remove_participant': {
      const { address: removeAddr } = updates || {};
      if (!removeAddr) throw new HttpsError('invalid-argument', 'address required');
      if (t.status !== 'registration') {
        throw new HttpsError('failed-precondition', 'Can only remove during registration');
      }
      await ref.update({
        participants: admin.firestore.FieldValue.arrayRemove(removeAddr),
        updatedAt: now,
      });
      break;
    }

    case 'add_wildcard': {
      const { address: addAddr } = updates || {};
      if (!addAddr) throw new HttpsError('invalid-argument', 'address required');
      if (t.status !== 'registration') {
        throw new HttpsError('failed-precondition', 'Can only add during registration');
      }
      await ref.update({
        participants: admin.firestore.FieldValue.arrayUnion(addAddr),
        updatedAt: now,
      });
      break;
    }

    case 'finalize':
      await finalizeBracketTournament(tournamentId);
      break;

    default:
      throw new HttpsError('invalid-argument', `Unknown action: ${action}`);
  }

  return { success: true, action };
});

// ─── Submit Match Score (bracket round) ───────────────────────────────────

export const submitBracketScore = onCall({ memory: '128MiB', maxInstances: 10 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { tournamentId, roundIndex, matchIndex, scores } = request.data;
  const player = request.auth.uid.toLowerCase();

  const ref = db.collection('bracketTournaments').doc(tournamentId);

  await db.runTransaction(async (txn) => {
    const snap = await txn.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', 'Tournament not found');

    const t = snap.data() as BracketTournament;
    if (t.status !== 'active') {
      throw new HttpsError('failed-precondition', 'Tournament not active');
    }

    const rounds = [...t.rounds];
    const round = rounds[roundIndex];
    if (!round) throw new HttpsError('not-found', 'Round not found');

    const match = { ...round.matches[matchIndex] } as BracketMatch;
    if (!match) throw new HttpsError('not-found', 'Match not found');
    if (match.status === 'complete' || match.status === 'bye') {
      throw new HttpsError('failed-precondition', 'Match already complete');
    }

    const totalScore = Array.isArray(scores) ? scores.reduce((a: number, b: number) => a + b, 0) : (scores as number);
    const isP1 = match.player1 === player;
    const isP2 = match.player2 === player;

    if (!isP1 && !isP2) throw new HttpsError('permission-denied', 'Not in this match');

    if (isP1) {
      if (match.player1Finished) throw new HttpsError('already-exists', 'Already submitted');
      match.player1Score = totalScore;
      match.player1Finished = true;
    } else {
      if (match.player2Finished) throw new HttpsError('already-exists', 'Already submitted');
      match.player2Score = totalScore;
      match.player2Finished = true;
    }

    if (match.player1Finished && match.player2Finished) {
      const winner = (match.player1Score ?? 0) >= (match.player2Score ?? 0)
        ? match.player1! : match.player2!;
      match.winner = winner;
      match.loser = winner === match.player1 ? match.player2 : match.player1;
      match.status = 'complete';
      match.completedAt = admin.firestore.Timestamp.now();
    }

    rounds[roundIndex].matches[matchIndex] = match;
    txn.update(ref, { rounds, updatedAt: admin.firestore.Timestamp.now() });
  });

  // After transaction, check if we need to propagate winner
  const freshSnap = await ref.get();
  if (freshSnap.exists) {
    const t = freshSnap.data() as BracketTournament;
    const match = t.rounds[roundIndex]?.matches[matchIndex];
    if (match?.status === 'complete' && match.winner) {
      await resolveMatchInBracket(tournamentId, roundIndex, matchIndex, match.winner, false);
    }
  }

  return { success: true };
});

// ─── Internal: resolve a match and propagate ──────────────────────────────

async function resolveMatchInBracket(
  tournamentId: string,
  roundIndex: number,
  matchIndex: number,
  winner: string,
  forceAdmin: boolean
) {
  const ref = db.collection('bracketTournaments').doc(tournamentId);

  await db.runTransaction(async (txn) => {
    const snap = await txn.get(ref);
    if (!snap.exists) return;

    const t = snap.data() as BracketTournament;
    let rounds = t.rounds;

    rounds = propagateWinner(rounds, roundIndex, matchIndex, winner);

    const finalRound = rounds[rounds.length - 1];
    const allDone = finalRound?.matches.every(m => m.status === 'complete' || m.status === 'bye');

    const updates: any = { rounds, updatedAt: admin.firestore.Timestamp.now() };

    if (allDone && finalRound?.matches.length === 1) {
      const finalWinner = finalRound.matches[0].winner;
      updates.status = 'completed';
      updates.winnerId = finalWinner;
      updates.completedAt = admin.firestore.Timestamp.now();
    }

    txn.update(ref, updates);
  });

  await updateParticipantHistory(tournamentId, roundIndex, matchIndex, winner);
}

async function finalizeBracketTournament(tournamentId: string) {
  const ref = db.collection('bracketTournaments').doc(tournamentId);
  const snap = await ref.get();
  if (!snap.exists) return;

  const t = snap.data() as BracketTournament;
  const now = admin.firestore.Timestamp.now();

  const finalRound = t.rounds[t.rounds.length - 1];
  const winner = finalRound?.matches[0]?.winner;

  await ref.update({
    status: 'completed',
    winnerId: winner || null,
    completedAt: now,
    updatedAt: now,
  });
}

async function updateParticipantHistory(
  tournamentId: string,
  roundIndex: number,
  matchIndex: number,
  winner: string
) {
  try {
    const ref = db.collection('bracketTournaments').doc(tournamentId);
    const snap = await ref.get();
    if (!snap.exists) return;

    const t = snap.data() as BracketTournament;
    const match = t.rounds[roundIndex]?.matches[matchIndex];
    if (!match || !match.loser) return;

    const now = admin.firestore.Timestamp.now();
    const batch = db.batch();

    const loserRef = ref.collection('participants').doc(match.loser);
    batch.set(loserRef, {
      isEliminated: true,
      eliminatedRound: roundIndex,
      updatedAt: now,
    }, { merge: true });

    const isFinalRound = roundIndex === t.rounds.length - 1;
    if (isFinalRound) {
      const winnerPrize = computePrize(1, t.prizePool, t.prizeStructure);
      const runnerUpPrize = computePrize(2, t.prizePool, t.prizeStructure);

      const winnerRef = ref.collection('participants').doc(winner);
      batch.set(winnerRef, {
        totalEarnings: admin.firestore.FieldValue.increment(winnerPrize),
        updatedAt: now,
      }, { merge: true });

      if (match.loser) {
        batch.set(loserRef, {
          totalEarnings: admin.firestore.FieldValue.increment(runnerUpPrize),
          updatedAt: now,
        }, { merge: true });
      }

      const winnerProfileRef = db.collection('userProfiles').doc(winner);
      batch.set(winnerProfileRef, {
        tournamentWins: admin.firestore.FieldValue.increment(1),
        tournamentEarnings: admin.firestore.FieldValue.increment(winnerPrize),
        updatedAt: now,
      }, { merge: true });
    }

    await batch.commit();
  } catch (err) {
    console.error('updateParticipantHistory error:', err);
  }
}

// ─── Get Bracket Data ──────────────────────────────────────────────────────

export const getBracketTournament = onCall({ memory: '128MiB', maxInstances: 10 }, async (request) => {
  const { tournamentId } = request.data;
  if (!tournamentId) throw new HttpsError('invalid-argument', 'tournamentId required');

  const ref = db.collection('bracketTournaments').doc(tournamentId);
  const [snap, participantsSnap] = await Promise.all([
    ref.get(),
    ref.collection('participants').get(),
  ]);

  if (!snap.exists) throw new HttpsError('not-found', 'Tournament not found');

  const t = snap.data();
  const participants = participantsSnap.docs.map(d => d.data());

  return { tournament: t, participants };
});

export const getBracketTournaments = onCall({ memory: '128MiB', maxInstances: 10 }, async (request) => {
  const { status, limit: rawLimit } = request.data || {};
  const pageLimit = Math.min(rawLimit || 20, 50);

  let query: admin.firestore.Query = db.collection('bracketTournaments');

  if (status) {
    query = query.where('status', '==', status);
  }

  const snap = await query
    .orderBy('displayNumber', 'desc')
    .limit(pageLimit)
    .get();

  return { tournaments: snap.docs.map(d => d.data()) };
});
