const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
let db;

function initFirebase() {
  if (admin.apps.length === 0) {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || './service-account.json';

    try {
      const serviceAccount = require(path.resolve(serviceAccountPath));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase initialized');
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error.message);
      console.log('   Make sure service-account.json exists in discord-bot folder');
      process.exit(1);
    }
  }

  db = admin.firestore();
  return db;
}

// Get user's game stats by wallet address
async function getGameStats(walletAddress) {
  const userDoc = await db.collection('users').doc(walletAddress.toLowerCase()).get();

  if (!userDoc.exists) {
    return null;
  }

  return {
    totalGamesPlayed: userDoc.data().totalGamesPlayed || 0,
    totalScore: userDoc.data().totalScore || 0,
    lastActive: userDoc.data().lastActive?.toDate() || null,
    createdAt: userDoc.data().createdAt?.toDate() || null
  };
}

// Check if user hit daily top 10
async function checkDailyTop10(walletAddress) {
  const globalDoc = await db.collection('globalLeaderboard').doc('daily').get();

  if (!globalDoc.exists) return false;

  const entries = globalDoc.data().entries || [];
  const top10 = entries.slice(0, 10);

  return top10.some(e =>
    e.odedId?.toLowerCase() === walletAddress.toLowerCase() ||
    e.odedid?.toLowerCase() === walletAddress.toLowerCase()
  );
}

// Check tournament wins
async function checkTournamentWins(walletAddress) {
  // Query tournaments where this user won
  const tournamentsSnap = await db.collection('tournaments')
    .where('winner', '==', walletAddress.toLowerCase())
    .limit(1)
    .get();

  return !tournamentsSnap.empty;
}

// Store Discord activity
async function storeDiscordActivity(discordId, data) {
  const ref = db.collection('discord_activity').doc(discordId);
  await ref.set(data, { merge: true });
}

// Get Discord activity
async function getDiscordActivity(discordId) {
  const doc = await db.collection('discord_activity').doc(discordId).get();
  return doc.exists ? doc.data() : null;
}

// Link Discord to wallet
async function linkWallet(discordId, walletAddress, username) {
  const ref = db.collection('discord_links').doc(discordId);

  // Check if wallet already linked to another Discord
  const existingLink = await db.collection('discord_links')
    .where('walletAddress', '==', walletAddress.toLowerCase())
    .limit(1)
    .get();

  if (!existingLink.empty && existingLink.docs[0].id !== discordId) {
    return { success: false, error: 'Wallet already linked to another Discord account' };
  }

  await ref.set({
    discordId,
    discordUsername: username,
    walletAddress: walletAddress.toLowerCase(),
    linkedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return { success: true };
}

// Get linked wallet for Discord user
async function getLinkedWallet(discordId) {
  const doc = await db.collection('discord_links').doc(discordId).get();
  return doc.exists ? doc.data().walletAddress : null;
}

// Get Discord ID by wallet
async function getDiscordByWallet(walletAddress) {
  const snap = await db.collection('discord_links')
    .where('walletAddress', '==', walletAddress.toLowerCase())
    .limit(1)
    .get();

  return snap.empty ? null : snap.docs[0].data().discordId;
}

// Increment message count
async function incrementMessageCount(discordId, username) {
  const ref = db.collection('discord_activity').doc(discordId);

  await ref.set({
    discordId,
    discordUsername: username,
    messageCount: admin.firestore.FieldValue.increment(1),
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const doc = await ref.get();
  return doc.data().messageCount || 1;
}

// Get all Discord activity for airdrop
async function getAllDiscordActivity() {
  const snap = await db.collection('discord_activity').get();
  return snap.docs.map(doc => ({ discordId: doc.id, ...doc.data() }));
}

// Get all Discord-wallet links
async function getAllLinks() {
  const snap = await db.collection('discord_links').get();
  return snap.docs.map(doc => ({ discordId: doc.id, ...doc.data() }));
}

module.exports = {
  initFirebase,
  getGameStats,
  checkDailyTop10,
  checkTournamentWins,
  storeDiscordActivity,
  getDiscordActivity,
  linkWallet,
  getLinkedWallet,
  getDiscordByWallet,
  incrementMessageCount,
  getAllDiscordActivity,
  getAllLinks
};
