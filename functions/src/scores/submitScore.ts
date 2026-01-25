import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { collections, db, Timestamp, FieldValue } from '../config/firebase';
import { GAME_CONFIGS } from '../config/games';
import { GameData, TournamentDocument } from '../types';
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
  { cors: true },
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

    // Handle tournament scores - auto-update ALL active tournaments the player has entered
    // This allows a single game to count toward multiple tournaments (weekly + monthly)
    if (sessionData.mode === 'tournament') {
      console.log(`🎮 TOURNAMENT MODE - Session tournamentId: ${sessionData.tournamentId}`);
      console.log(`🎮 Player: ${playerAddress}, Game: ${gameId}, Score: ${verifiedScore}`);

      // Auto-update all applicable tournament entries
      await updateActiveTournamentEntries(playerAddress, gameId, verifiedScore, now);

      // Update user stats (for Zealy verification and airdrop eligibility)
      await updateUserGamesPlayed(playerAddress, now);

      return {
        success: true,
        verified: true,
        score: verifiedScore,
        newBest: true, // Tournament scores are always considered "new" for display
        flags: analysis.flags.length > 0 ? analysis.flags : undefined,
      };
    }

    // Only save ranked scores to regular leaderboards (skip free play)
    if (sessionData.mode === 'free') {
      // Still update user stats for Zealy verification and airdrop eligibility
      await updateUserGamesPlayed(playerAddress, now);

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

    // AUTO-UPDATE TOURNAMENT ENTRIES
    // Any ranked game automatically counts toward active tournaments the player has entered
    await updateActiveTournamentEntries(playerAddress, gameId, verifiedScore, now);

    // Update user stats
    // First, ensure user document exists with complete schema
    const userRef = collections.users.doc(playerAddress);
    const userDocCheck = await userRef.get();

    if (!userDocCheck.exists) {
      // Create complete user document if it doesn't exist
      console.log('Creating user document during score submission for:', playerAddress);
      await userRef.set({
        address: playerAddress,
        username: null,
        createdAt: now,
        lastActive: now,
        totalGamesPlayed: 0,
        totalScore: 0,
        isBanned: false,
        banReason: null,
        bannedAt: null,
        displayPreference: 'address',
        flags: {
          count: 0,
          lastFlagged: null,
          reasons: [],
        },
      });
    }

    // Now update the stats
    await userRef.update({
      totalGamesPlayed: FieldValue.increment(1),
      totalScore: FieldValue.increment(newBest ? verifiedScore - currentBest : 0),
      lastActive: now,
    });

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

/**
 * Auto-update tournament entries for active tournaments
 * When a player plays a ranked game, their score automatically counts toward
 * any active tournaments they've entered (no special tournament mode needed)
 */
async function updateActiveTournamentEntries(
  playerAddress: string,
  gameId: string,
  score: number,
  now: FirebaseFirestore.Timestamp
): Promise<void> {
  try {
    const tournamentIds = new Set<string>();
    const tournamentsToProcess: FirebaseFirestore.QueryDocumentSnapshot[] = [];

    // Query 1: Get tournaments with status='active'
    const activeByStatus = await db
      .collection('tournaments')
      .where('status', '==', 'active')
      .get();

    for (const doc of activeByStatus.docs) {
      if (!tournamentIds.has(doc.id)) {
        tournamentIds.add(doc.id);
        tournamentsToProcess.push(doc);
      }
    }

    // Query 2: Get tournaments with status='upcoming' that should be active by time
    // This catches tournaments where the status update hasn't run yet
    try {
      const upcomingSnapshot = await db
        .collection('tournaments')
        .where('status', '==', 'upcoming')
        .get();

      const nowMillis = now.toMillis();
      for (const doc of upcomingSnapshot.docs) {
        if (tournamentIds.has(doc.id)) continue;

        const data = doc.data();
        // Check if the tournament should be active by time
        const startTimeMillis = toMillisHelper(data.startTime);
        const endTimeMillis = toMillisHelper(data.endTime);

        if (startTimeMillis && endTimeMillis &&
            startTimeMillis <= nowMillis && nowMillis < endTimeMillis) {
          tournamentIds.add(doc.id);
          tournamentsToProcess.push(doc);
          console.log(`📋 Tournament ${doc.id} is status='upcoming' but time-active, including in score sync`);
        }
      }
    } catch (upcomingError) {
      console.log(`⚠️ Error checking upcoming tournaments:`, upcomingError);
    }

    if (tournamentsToProcess.length > 0) {
      console.log(`📋 Found ${tournamentsToProcess.length} tournaments for score sync (player: ${playerAddress})`);
      await processEntriesFromDocs(tournamentsToProcess, playerAddress, gameId, score, now);
    } else {
      console.log(`📋 No active tournaments found for score sync (player: ${playerAddress}, game: ${gameId})`);
    }
  } catch (error) {
    // Don't fail the score submission if tournament update fails
    console.error('❌ Error updating tournament entries:', error);
  }
}

/**
 * Helper to convert timestamp to milliseconds
 */
function toMillisHelper(value: any): number | null {
  if (!value) return null;
  if (typeof value === 'object' && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  if (typeof value === 'number') {
    return value < 1000000000000 ? value * 1000 : value;
  }
  return null;
}

/**
 * Process tournament entries and update scores from document array
 */
async function processEntriesFromDocs(
  tournamentDocs: FirebaseFirestore.QueryDocumentSnapshot[],
  playerAddress: string,
  gameId: string,
  score: number,
  now: FirebaseFirestore.Timestamp
): Promise<void> {
  try {
    // Check each tournament for player's entry
    for (const tournamentDoc of tournamentDocs) {
      const tournament = tournamentDoc.data() as TournamentDocument;
      const tournamentId = tournamentDoc.id;

      // Check if this is a single-game tournament that doesn't match our game
      if (tournament.gameId && tournament.gameId !== gameId) {
        continue; // Skip - this tournament is for a different game
      }

      // Check if player has an entry in this tournament
      const entryRef = db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('entries')
        .doc(playerAddress);

      const entryDoc = await entryRef.get();

      if (!entryDoc.exists) {
        console.log(`⏭️ Player ${playerAddress} has no entry in tournament ${tournamentId}`);
        continue; // Player hasn't entered this tournament
      }

      // Update the entry with the new score
      const entryData = entryDoc.data();
      const currentBestScores = entryData?.bestScores || {};
      const currentGameBest = currentBestScores[gameId] || 0;

      if (score <= currentGameBest) {
        console.log(`⏭️ Score ${score} not better than current best ${currentGameBest} for ${gameId} in tournament ${tournamentId}`);
        continue; // Not a new best for this game
      }

      // Calculate updated scores
      const updatedBestScores = {
        ...currentBestScores,
        [gameId]: score,
      };
      const totalScore = Object.values(updatedBestScores).reduce(
        (sum: number, s) => sum + (s as number),
        0
      );

      // Legacy: also track single bestScore (highest across any game)
      const legacyBest = entryData?.bestScore || 0;
      const newLegacyBest = Math.max(legacyBest, score);

      // Update tournament entry
      await entryRef.update({
        bestScore: newLegacyBest,
        bestScores: updatedBestScores,
        totalScore,
        lastPlayedAt: now,
        totalPlays: FieldValue.increment(1),
      });

      console.log(
        `🏆 Tournament ${tournamentId} updated for ${playerAddress}: ${gameId} = ${score} (total: ${totalScore})`
      );
    }
  } catch (error) {
    // Don't fail the score submission if tournament update fails
    console.error('❌ Error updating tournament entries:', error);
  }
}

/**
 * Update user's totalGamesPlayed counter (for Zealy verification and airdrop eligibility)
 * This is called for ALL game modes (ranked, tournament, free)
 */
async function updateUserGamesPlayed(
  playerAddress: string,
  now: FirebaseFirestore.Timestamp
): Promise<void> {
  try {
    const userRef = collections.users.doc(playerAddress);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // Create user document if it doesn't exist
      console.log('Creating user document for games tracking:', playerAddress);
      await userRef.set({
        address: playerAddress,
        username: null,
        createdAt: now,
        lastActive: now,
        totalGamesPlayed: 1,
        totalScore: 0,
        isBanned: false,
        banReason: null,
        bannedAt: null,
        displayPreference: 'address',
        flags: {
          count: 0,
          lastFlagged: null,
          reasons: [],
        },
      });
    } else {
      // Increment games played
      await userRef.update({
        totalGamesPlayed: FieldValue.increment(1),
        lastActive: now,
      });
    }
  } catch (error) {
    // Don't fail the score submission if user update fails
    console.error('❌ Error updating user games played:', error);
  }
}
