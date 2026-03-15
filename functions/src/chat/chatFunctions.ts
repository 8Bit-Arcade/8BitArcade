import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { ChatMessage } from '../pvp/pvpTypes';

const db = admin.firestore();

const SUPPORTED_REACTIONS = ['😄', '❤️', '🔥', '🎮', '⚔️', '💎', '😂', '👏', '😮', '👍'];
const MAX_MESSAGE_LENGTH = 500;
const RATE_LIMIT_MS = 2000; // 2 sec between messages per user

/**
 * sendChatMessage — posts a message to global arena chat or match chat.
 */
export const sendChatMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

  const { text, chatType, matchId, replyToId, gifUrl } = data;
  const author = context.auth.uid.toLowerCase();

  // ── Validation ──────────────────────────────────────────────────────────
  if (!text && !gifUrl) throw new functions.https.HttpsError('invalid-argument', 'Text or GIF required');
  if (text && text.length > MAX_MESSAGE_LENGTH) {
    throw new functions.https.HttpsError('invalid-argument', `Max ${MAX_MESSAGE_LENGTH} characters`);
  }
  if (chatType === 'match' && !matchId) {
    throw new functions.https.HttpsError('invalid-argument', 'matchId required for match chat');
  }

  // ── Ban check ───────────────────────────────────────────────────────────
  const userDoc = await db.collection('users').doc(author).get();
  if (userDoc.exists && userDoc.data()?.isBanned) {
    throw new functions.https.HttpsError('permission-denied', 'Account is banned');
  }

  // ── Rate limiting ────────────────────────────────────────────────────────
  const rateRef = db.collection('chatRateLimits').doc(author);
  const rateSnap = await rateRef.get();
  const now = Date.now();
  if (rateSnap.exists) {
    const lastSent = rateSnap.data()?.lastSent || 0;
    if (now - lastSent < RATE_LIMIT_MS) {
      throw new functions.https.HttpsError('resource-exhausted', 'Sending too fast, slow down!');
    }
  }
  await rateRef.set({ lastSent: now }, { merge: true });

  // ── Get display name ────────────────────────────────────────────────────
  const profileSnap = await db.collection('userProfiles').doc(author).get();
  const profile = profileSnap.data();
  const displayName = profile?.displayName || userDoc.data()?.username || `${author.slice(0, 6)}...${author.slice(-4)}`;
  const avatarUrl = profile?.avatarUrl || null;

  // ── Fetch reply context if provided ────────────────────────────────────
  let replyToText: string | null = null;
  let replyToAuthor: string | null = null;
  if (replyToId) {
    const collection = chatType === 'match' ? `pvpMatchChat_${matchId}` : 'pvpChat';
    const replySnap = await db.collection(collection).doc(replyToId).get();
    if (replySnap.exists) {
      replyToText = replySnap.data()?.text?.slice(0, 80) || null;
      replyToAuthor = replySnap.data()?.displayName || null;
    }
  }

  // ── Write message ───────────────────────────────────────────────────────
  const collection = chatType === 'match' ? `pvpMatchChat_${matchId}` : 'pvpChat';
  const msgRef = db.collection(collection).doc();

  const message: ChatMessage = {
    id: msgRef.id,
    author,
    displayName,
    avatarUrl,
    text: text || '',
    timestamp: admin.firestore.Timestamp.now(),
    replyTo: replyToId || null,
    replyToText,
    replyToAuthor,
    reactions: {},
    isPinned: false,
    gifUrl: gifUrl || null,
    isDeleted: false,
    chatType: chatType || 'arena',
    matchId: matchId || null,
  };

  await msgRef.set(message);

  return { messageId: msgRef.id };
});

/**
 * addReaction — toggle an emoji reaction on a message.
 */
export const addReaction = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

  const { messageId, emoji, chatType, matchId } = data;
  const player = context.auth.uid.toLowerCase();

  if (!messageId || !emoji) {
    throw new functions.https.HttpsError('invalid-argument', 'messageId and emoji required');
  }
  if (!SUPPORTED_REACTIONS.includes(emoji)) {
    throw new functions.https.HttpsError('invalid-argument', 'Unsupported reaction emoji');
  }

  const collection = chatType === 'match' ? `pvpMatchChat_${matchId}` : 'pvpChat';
  const msgRef = db.collection(collection).doc(messageId);

  await db.runTransaction(async (txn) => {
    const snap = await txn.get(msgRef);
    if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Message not found');

    const reactions = snap.data()?.reactions || {};
    const emojiReactors: string[] = reactions[emoji] || [];

    // Toggle: add if not there, remove if already reacted
    if (emojiReactors.includes(player)) {
      const updated = emojiReactors.filter(a => a !== player);
      if (updated.length === 0) {
        delete reactions[emoji];
      } else {
        reactions[emoji] = updated;
      }
    } else {
      reactions[emoji] = [...emojiReactors, player];
    }

    txn.update(msgRef, { reactions });
  });

  return { success: true };
});

/**
 * deleteMessage — admin or message author can delete.
 */
export const deleteMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

  const { messageId, chatType, matchId } = data;
  const player = context.auth.uid.toLowerCase();

  const collection = chatType === 'match' ? `pvpMatchChat_${matchId}` : 'pvpChat';
  const msgRef = db.collection(collection).doc(messageId);
  const snap = await msgRef.get();

  if (!snap.exists) throw new functions.https.HttpsError('not-found', 'Message not found');

  const msg = snap.data()!;
  if (msg.author !== player) {
    throw new functions.https.HttpsError('permission-denied', 'Can only delete your own messages');
  }

  await msgRef.update({ isDeleted: true, text: '[deleted]', gifUrl: null });
  return { success: true };
});

/**
 * pinMessage — admin only.
 */
export const pinMessage = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');

  const { messageId, pinned } = data;
  const collection = 'pvpChat';
  await db.collection(collection).doc(messageId).update({ isPinned: !!pinned });
  return { success: true };
});

/**
 * getChatMessages — returns recent messages, newest last.
 */
export const getChatMessages = functions.https.onCall(async (data, _context) => {
  const { chatType, matchId, limit: rawLimit } = data || {};
  const pageLimit = Math.min(rawLimit || 50, 100);

  const collection = chatType === 'match' ? `pvpMatchChat_${matchId}` : 'pvpChat';

  const snap = await db.collection(collection)
    .where('isDeleted', '==', false)
    .orderBy('timestamp', 'desc')
    .limit(pageLimit)
    .get();

  const messages = snap.docs.map(d => d.data()).reverse();
  return { messages };
});
