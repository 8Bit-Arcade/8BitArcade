import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { UserProfile } from '../pvp/pvpTypes';

const db = admin.firestore();

const MAX_BIO_LENGTH = 280;
const VALID_FRAMES = [0, 1, 2, 3, 4, 5, 6, 7];

/**
 * updateUserProfile — create or update a player's public profile.
 */
export const updateUserProfile = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

  const player = context.auth.uid.toLowerCase();
  const { bio, avatarUrl, avatarFrame, socialTwitter, socialDiscord,
          displayName, privacyShowWinRate, privacyShowEarnings } = data;

  const updates: Partial<UserProfile & { updatedAt: any }> = {
    address: player,
    updatedAt: admin.firestore.Timestamp.now(),
  };

  if (bio !== undefined) {
    if (typeof bio !== 'string') throw new functions.https.HttpsError('invalid-argument', 'bio must be string');
    if (bio.length > MAX_BIO_LENGTH) throw new functions.https.HttpsError('invalid-argument', `Bio max ${MAX_BIO_LENGTH} chars`);
    updates.bio = bio.trim();
  }
  if (avatarUrl !== undefined) {
    // Basic URL validation - must be Firebase Storage URL or empty
    if (avatarUrl && !avatarUrl.startsWith('https://firebasestorage.googleapis.com')) {
      throw new functions.https.HttpsError('invalid-argument', 'avatarUrl must be a Firebase Storage URL');
    }
    updates.avatarUrl = avatarUrl || null;
  }
  if (avatarFrame !== undefined) {
    if (!VALID_FRAMES.includes(avatarFrame)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid avatar frame');
    }
    updates.avatarFrame = avatarFrame;
  }
  if (socialTwitter !== undefined) {
    updates.socialTwitter = socialTwitter ? String(socialTwitter).replace('@', '').slice(0, 50) : null;
  }
  if (socialDiscord !== undefined) {
    updates.socialDiscord = socialDiscord ? String(socialDiscord).slice(0, 50) : null;
  }
  if (displayName !== undefined) {
    if (typeof displayName !== 'string' || displayName.length > 30) {
      throw new functions.https.HttpsError('invalid-argument', 'displayName max 30 chars');
    }
    updates.displayName = displayName.trim();
  }
  if (privacyShowWinRate !== undefined) updates.privacyShowWinRate = !!privacyShowWinRate;
  if (privacyShowEarnings !== undefined) updates.privacyShowEarnings = !!privacyShowEarnings;

  const profileRef = db.collection('userProfiles').doc(player);
  const snap = await profileRef.get();

  if (!snap.exists) {
    // Initialize defaults
    await profileRef.set({
      address: player,
      displayName: displayName || '',
      bio: bio || '',
      avatarUrl: null,
      avatarFrame: 0,
      socialTwitter: null,
      socialDiscord: null,
      pvpWins: 0,
      pvpLosses: 0,
      pvpEarnings: 0,
      tournamentWins: 0,
      tournamentEarnings: 0,
      privacyShowWinRate: true,
      privacyShowEarnings: false,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      ...updates,
    });
  } else {
    await profileRef.update(updates);
  }

  return { success: true };
});

/**
 * getUserProfile — returns a player's public profile + computed stats.
 */
export const getUserProfile = functions.https.onCall(async (data, context) => {
  const { address } = data;
  if (!address || typeof address !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'address required');
  }

  const normalizedAddress = address.toLowerCase();
  const requestingPlayer = context.auth?.uid?.toLowerCase() || null;
  const isOwnProfile = requestingPlayer === normalizedAddress;

  const [profileSnap, userSnap] = await Promise.all([
    db.collection('userProfiles').doc(normalizedAddress).get(),
    db.collection('users').doc(normalizedAddress).get(),
  ]);

  const profile = profileSnap.data() || {};
  const user = userSnap.data() || {};

  // Resolve display name priority: profile > username > truncated address
  const displayName = profile.displayName ||
    user.username ||
    user.ensName ||
    `${normalizedAddress.slice(0, 6)}...${normalizedAddress.slice(-4)}`;

  // Apply privacy settings for non-own profiles
  const result: any = {
    address: normalizedAddress,
    displayName,
    bio: profile.bio || '',
    avatarUrl: profile.avatarUrl || null,
    avatarFrame: profile.avatarFrame || 0,
    socialTwitter: profile.socialTwitter || null,
    socialDiscord: profile.socialDiscord || null,
    pvpWins: profile.pvpWins || 0,
    pvpLosses: profile.pvpLosses || 0,
    pvpEarnings: (isOwnProfile || profile.privacyShowEarnings) ? (profile.pvpEarnings || 0) : null,
    tournamentWins: profile.tournamentWins || 0,
    tournamentEarnings: (isOwnProfile || profile.privacyShowEarnings) ? (profile.tournamentEarnings || 0) : null,
    privacyShowWinRate: profile.privacyShowWinRate ?? true,
    privacyShowEarnings: profile.privacyShowEarnings ?? false,
    createdAt: profile.createdAt || null,
    memberSince: user.createdAt || null,
    totalGamesPlayed: user.totalGamesPlayed || 0,
    totalScore: user.totalScore || 0,
    isBanned: user.isBanned || false,
  };

  // Hide win rate if privacy setting is off (for others)
  if (!isOwnProfile && !profile.privacyShowWinRate) {
    result.pvpWins = null;
    result.pvpLosses = null;
  }

  // Fetch recent PvP match history
  const recentMatchesSnap = await db.collection('pvpMatches')
    .where('status', '==', 'completed')
    .orderBy('completedAt', 'desc')
    .limit(10)
    .get();

  const matchHistory = recentMatchesSnap.docs
    .map(d => d.data())
    .filter(m => m.creator === normalizedAddress || m.challenger === normalizedAddress)
    .slice(0, 10)
    .map(m => {
      const isCreator = m.creator === normalizedAddress;
      const myScore = isCreator ? m.creatorTotalScore : m.challengerTotalScore;
      const oppScore = isCreator ? m.challengerTotalScore : m.creatorTotalScore;
      const opponent = isCreator ? m.challenger : m.creator;
      const won = m.winner === normalizedAddress;
      return {
        matchId: m.id,
        displayNumber: m.displayNumber,
        opponent: opponent || 'Unknown',
        gameIds: m.gameIds,
        numGames: m.numGames,
        myScore,
        oppScore,
        betAmount: m.betAmount,
        result: won ? 'win' : 'loss',
        completedAt: m.completedAt,
      };
    });

  result.matchHistory = matchHistory;

  return result;
});
