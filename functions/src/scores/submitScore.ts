import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { collections, Timestamp, FieldValue } from '../config/firebase';
import { GAME_CONFIGS } from '../config/games';
import { GameData } from '../types';
import { analyzeGameplay, verifyChecksum } from '../anticheat/statisticalAnalysis';
import { flagAccount as flagAccountDetailed, isAccountBanned } from '../anticheat/flagging';
// Replay validation disabled - too many false positives
// import { replayAlienAssault } from '../anticheat/replay/alienAssaultReplay';
// import { replaySpaceRocks } from '../anticheat/replay/spaceRocksReplay';
// import { replayBrickBreaker } from '../anticheat/replay/brickBreakerReplay';
// import { replayPixelSnake } from '../anticheat/replay/pixelSnakeReplay';

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

    // Check if account is banned
    const isBanned = await isAccountBanned(playerAddress);
    if (isBanned) {
      throw new HttpsError('permission-denied', 'Account is banned');
    }

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
      await flagAccountDetailed(playerAddress, {
        type: 'score_mismatch',
        severity: 'high',
        gameId,
        sessionId,
        claimedScore: finalScore,
        details: { reason: 'Checksum mismatch' },
      });
      throw new HttpsError('invalid-argument', 'Checksum verification failed');
    }

    // Perform statistical analysis
    const analysis = analyzeGameplay(gameId, inputs, finalScore, duration);

    // If analysis finds serious issues, flag and/or reject
    if (analysis.flags.length > 0) {
      const highSeverityFlags = analysis.flags.filter(f => f === 'impossible_score' || f === 'impossible_reaction_time');

      if (highSeverityFlags.length > 0 || analysis.confidence > 0.7) {
        // High confidence cheating - flag and reject
        await flagAccountDetailed(playerAddress, {
          type: 'multiple_violations',
          severity: 'high',
          gameId,
          sessionId,
          claimedScore: finalScore,
          details: {
            flags: analysis.flags,
            confidence: analysis.confidence,
          },
        });
        throw new HttpsError('invalid-argument', 'Score validation failed - suspicious activity detected');
      } else if (analysis.confidence > 0.4) {
        // Medium suspicion - flag but allow (for now)
        await flagAccountDetailed(playerAddress, {
          type: 'multiple_violations',
          severity: 'medium',
          gameId,
          sessionId,
          claimedScore: finalScore,
          details: {
            flags: analysis.flags,
            confidence: analysis.confidence,
          },
        });
      }
    }

    // REPLAY VALIDATION DISABLED
    // Replay engines are too simplified and cause excessive false positives
    // Even intentional low scores (dying on level 1) trigger 60x+ ratios
    // Statistical analysis (input patterns, reaction times) is sufficient for anti-cheat
    const verifiedScore = finalScore;

    console.log(`✅ Score accepted for ${playerAddress} (${gameId}): ${verifiedScore} points (replay validation disabled)`);

    // Mark session as completed
    await sessionRef.update({
      completedAt: now,
      finalScore: verifiedScore,
      verified: true,
    });

    // Handle tournament scores separately
    if (sessionData.mode === 'tournament') {
      if (!sessionData.tournamentId) {
        throw new HttpsError('invalid-argument', 'Tournament ID missing for tournament session');
      }

      // Update tournament entry
      const tournamentEntryRef = collections.tournaments
        .doc(sessionData.tournamentId)
        .collection('entries')
        .doc(playerAddress);

      const entryDoc = await tournamentEntryRef.get();

      if (!entryDoc.exists) {
        throw new HttpsError('not-found', 'Tournament entry not found. Must enter tournament first.');
      }

      const entryData = entryDoc.data();
      const currentBest = entryData?.bestScore || 0;
      const newBest = verifiedScore > currentBest;

      // Update tournament entry
      await tournamentEntryRef.update({
        bestScore: newBest ? verifiedScore : currentBest,
        lastPlayedAt: now,
        totalPlays: FieldValue.increment(1),
      });

      return {
        success: true,
        verified: true,
        score: verifiedScore,
        newBest,
        flags: analysis.flags.length > 0 ? analysis.flags : undefined,
      };
    }

    // Only save ranked scores to regular leaderboards (skip free play)
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
      // Get updated total score for global leaderboard
      const updatedScoreDoc = await scoreRef.get();
      const newTotalScore = updatedScoreDoc.data()?.totalScore || 0;
      await updateGlobalLeaderboard(playerAddress, username, newTotalScore);
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

/**
 * Update global leaderboard (all games combined) with new score
 */
async function updateGlobalLeaderboard(
  playerId: string,
  username: string,
  totalScore: number
): Promise<void> {
  const now = Timestamp.now();

  const entry = {
    odedId: playerId,
    username,
    score: totalScore,
    timestamp: now,
  };

  // Update each period (daily, weekly, allTime)
  for (const period of ['daily', 'weekly', 'allTime'] as const) {
    const globalRef = collections.globalLeaderboard.doc(period);
    const doc = await globalRef.get();

    if (!doc.exists) {
      // Create new global leaderboard
      await globalRef.set({
        lastUpdated: now,
        entries: [entry],
      });
      continue;
    }

    const data = doc.data();
    if (!data) continue;

    // Update list
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

    await globalRef.update({
      lastUpdated: now,
      entries: updateList(data.entries || []),
    });
  }
}
