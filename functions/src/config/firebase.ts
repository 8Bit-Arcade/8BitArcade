import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const auth = admin.auth();
export const FieldValue = admin.firestore.FieldValue;
export const Timestamp = admin.firestore.Timestamp;

// Collection references
export const collections = {
  users: db.collection('users'),
  games: db.collection('games'),
  sessions: db.collection('sessions'),
  scores: db.collection('scores'),
  leaderboards: db.collection('leaderboards'),
  globalLeaderboard: db.collection('globalLeaderboard'),
  tournaments: db.collection('tournaments'),
  rewards: db.collection('rewards'),
};
