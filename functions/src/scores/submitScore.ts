import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { collections, Timestamp, FieldValue } from '../config/firebase';
import { GAME_CONFIGS } from '../config/games';
import { GameData } from '../types';
import { analyzeGameplay, verifyChecksum } from '../anticheat/statisticalAnalysis';

interface SubmitScoreRequest {
  gameData: GameData;
}

interface SubmitScoreResponse {
  success: boolean;
  verified: boolean;
  score: number;
  newBest: boolean;
  rank?: number;
  flags?: string[];
}

export const submitScore = onCall<SubmitScoreRequest, Promise<SubmitScoreResponse>>(
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in to submit scores');
    }

    const { gameData } = request.data;
    const { sessionId, gameId, seed, inputs, finalScore, duration, checksum } = gameData;
    const playerAddress = request.auth.uid.toLowerCase();

    // Validate game exists
    if (!GAME_CONFIGS[gameId]) {
      throw new HttpsError('invalid-argument', `Invalid game: ${gameId}`);
    }

    // Verify session exists and belongs to player
    const sessionRef = collections.sessions.doc(sessionId);
    const session = await sessionRef.get();

    if (!session.exists) {
      throw new HttpsError('not-found', 'Session not found');
    }

    const sessionData = session.data();
    if (!sessionData) {
      throw new HttpsError('internal', 'Session data is empty');
    }

    if (sessionData.player !== playerAddress) {
      throw new HttpsError('permission-denied', 'Session belongs to another player');
    }

    if (sessionData.completedAt) {
      throw new HttpsError('already-exists', 'Session already completed');
    }

    // Check session hasn't expired
    const now = Timestamp.now();
    if (sessionData.expiresAt.toMillis() < now.toMillis()) {
      throw new HttpsError('deadline-exceeded', 'Session has expired');
    }

    // Verify checksum
    if (!verifyChecksum(inputs, seed, checksum)) {
      await flagAccount(playerAddress, 'checksum_mismatch', gameId, sessionId);
      throw new HttpsError('invalid-argument', 'Checksum verification failed');
    }

    // Perform statistical analysis
    const analysis = analyzeGameplay(gameId, inputs, finalScore, duration);

    // If analysis finds serious issues, flag and reject
    if (analysis.flags.length > 2 || analysis.confidence > 0.6) {
      await flagAccount(playerAddress, analysis.flags.join(', '), gameId, sessionId);
      throw new HttpsError('invalid-argument', 'Score validation failed');
    }

    // TODO: In production, perform server-side replay here
    // For now, we trust scores that pass statistical analysis
    const verifiedScore = finalScore;

    // Mark session as completed
    await sessionRef.update({
      completedAt: now,
      finalScore: verifiedScore,
      verified: true,
    });

    // Only save ranked/tournament scores to leaderboards
    if (sessionData.mode === 'free') {
      return {
        success: true,
        verified: true,
        score: verifiedScore,
        newBest: false,
      };
    }

    // Get or create user's score document
    const scoreRef = collections.scores.doc(playerAddress);
    const scoreDoc = await scoreRef.get();

    let newBest = false;
    let currentBest = 0;

    if (scoreDoc.exists) {
      const data = scoreDoc.data();
      currentBest = data?.games?.[gameId]?.bestScore || 0;
      newBest = verifiedScore > currentBest;
    } else {
      newBest = true;
    }

    // Get username
    const userDoc = await collections.users.doc(playerAddress).get();
    const username = userDoc.data()?.username || playerAddress.slice(0, 8);

    // Update score document
    await scoreRef.set(
      {
        odedId: playerAddress,
        username,
        games: {
          [gameId]: {
            bestScore: newBest ? verifiedScore : currentBest,
            totalPlays: FieldValue.increment(1),
            lastPlayed: now,
          },
        },
        totalScore: FieldValue.increment(newBest ? verifiedScore - currentBest : 0),
        totalGames: FieldValue.increment(1),
      },
      { merge: true }
    );

    // Update leaderboard if new best
    if (newBest) {
      await updateLeaderboard(gameId, playerAddress, username, verifiedScore);
    }

    // Update user stats
    await collections.users.doc(playerAddress).set(
      {
        totalGamesPlayed: FieldValue.increment(1),
        totalScore: FieldValue.increment(newBest ? verifiedScore - currentBest : 0),
        lastActive: now,
      },
      { merge: true }
    );

    return {
      success: true,
      verified: true,
      score: verifiedScore,
      newBest,
      flags: analysis.flags.length > 0 ? analysis.flags : undefined,
    };
  }
);

/**
 * Flag an account for suspicious activity
 */
async function flagAccount(
  address: string,
  reason: string,
  gameId: string,
  sessionId: string
): Promise<void> {
  const userRef = collections.users.doc(address);

  await userRef.set(
    {
      flags: {
        count: FieldValue.increment(1),
        reasons: FieldValue.arrayUnion(reason),
        lastFlagged: Timestamp.now(),
      },
    },
    { merge: true }
  );

  // Log the flag event
  console.warn(`Account flagged: ${address}`, {
    reason,
    gameId,
    sessionId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Update leaderboard with new score
 */
async function updateLeaderboard(
  gameId: string,
  playerId: string,
  username: string,
  score: number
): Promise<void> {
  const leaderboardRef = collections.leaderboards.doc(gameId);
  const now = Timestamp.now();

  const entry = {
    odedId: playerId,
    username,
    score,
    timestamp: now,
  };

  // Get current leaderboard
  const doc = await leaderboardRef.get();

  if (!doc.exists) {
    // Create new leaderboard
    await leaderboardRef.set({
      gameId,
      lastUpdated: now,
      daily: [entry],
      weekly: [entry],
      allTime: [entry],
    });
    return;
  }

  const data = doc.data();
  if (!data) return;

  // Update each leaderboard type
  const updateList = (list: any[], maxSize: number = 100) => {
    // Remove existing entry for this player
    const filtered = list.filter((e: any) => e.odedId !== playerId);
    // Add new entry
    filtered.push(entry);
    // Sort by score descending
    filtered.sort((a: any, b: any) => b.score - a.score);
    // Keep only top entries
    return filtered.slice(0, maxSize);
  };

  await leaderboardRef.update({
    lastUpdated: now,
    daily: updateList(data.daily || []),
    weekly: updateList(data.weekly || []),
    allTime: updateList(data.allTime || []),
  });
}
