import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { ChatMessage } from '../pvp/pvpTypes';

const db = admin.firestore();

const SUPPORTED_REACTIONS = ['😄', '❤️', '🔥', '🎮', '⚔️', '💎', '😂', '👏', '😮', '👍'];
const MAX_MESSAGE_LENGTH = 500;
const RATE_LIMIT_MS = 2000; // 2 sec between messages per user

/**
 * sendChatMessage — posts a message to global arena chat or match chat.
 */
export const sendChatMessage = onCall({ memory: '128MiB', maxInstances: 20 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { text, chatType, matchId, replyToId, gifUrl } = request.data;
  const author = request.auth.uid.toLowerCase();

  // ── Validation ──────────────────────────────────────────────────────────
  if (!text && !gifUrl) throw new HttpsError('invalid-argument', 'Text or GIF required');
  if (text && text.length > MAX_MESSAGE_LENGTH) {
    throw new HttpsError('invalid-argument', `Max ${MAX_MESSAGE_LENGTH} characters`);
  }
  if (chatType === 'match' && !matchId) {
    throw new HttpsError('invalid-argument', 'matchId required for match chat');
  }

  // ── Ban check ───────────────────────────────────────────────────────────
  const userDoc = await db.collection('users').doc(author).get();
  if (userDoc.exists && userDoc.data()?.isBanned) {
    throw new HttpsError('permission-denied', 'Account is banned');
  }

  // ── Rate limiting ────────────────────────────────────────────────────────
  const rateRef = db.collection('chatRateLimits').doc(author);
  const rateSnap = await rateRef.get();
  const now = Date.now();
  if (rateSnap.exists) {
    const lastSent = rateSnap.data()?.lastSent || 0;
    if (now - lastSent < RATE_LIMIT_MS) {
      throw new HttpsError('resource-exhausted', 'Sending too fast, slow down!');
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
    const replySnap = await (chatType === 'match'
      ? db.collection('pvpMatches').doc(matchId).collection('chat').doc(replyToId).get()
      : db.collection('pvpChat').doc(replyToId).get());
    if (replySnap.exists) {
      replyToText = replySnap.data()?.text?.slice(0, 80) || null;
      replyToAuthor = replySnap.data()?.displayName || null;
    }
  }

  // ── Write message ───────────────────────────────────────────────────────
  const msgRef = chatType === 'match'
    ? db.collection('pvpMatches').doc(matchId).collection('chat').doc()
    : db.collection('pvpChat').doc();

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
export const addReaction = onCall({ memory: '128MiB', maxInstances: 20 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { messageId, emoji, chatType, matchId } = request.data;
  const player = request.auth.uid.toLowerCase();

  if (!messageId || !emoji) {
    throw new HttpsError('invalid-argument', 'messageId and emoji required');
  }
  if (!SUPPORTED_REACTIONS.includes(emoji)) {
    throw new HttpsError('invalid-argument', 'Unsupported reaction emoji');
  }

  const msgRef = chatType === 'match'
    ? db.collection('pvpMatches').doc(matchId).collection('chat').doc(messageId)
    : db.collection('pvpChat').doc(messageId);

  await db.runTransaction(async (txn) => {
    const snap = await txn.get(msgRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Message not found');

    const reactions = snap.data()?.reactions || {};
    const emojiReactors: string[] = reactions[emoji] || [];

    // Toggle: add if not there, remove if already reacted
    if (emojiReactors.includes(player)) {
      const updated = emojiReactors.filter((a: string) => a !== player);
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
export const deleteMessage = onCall({ memory: '128MiB', maxInstances: 5 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { messageId, chatType, matchId } = request.data;
  const player = request.auth.uid.toLowerCase();

  const msgRef = chatType === 'match'
    ? db.collection('pvpMatches').doc(matchId).collection('chat').doc(messageId)
    : db.collection('pvpChat').doc(messageId);
  const snap = await msgRef.get();

  if (!snap.exists) throw new HttpsError('not-found', 'Message not found');

  const msg = snap.data()!;
  if (msg.author !== player) {
    throw new HttpsError('permission-denied', 'Can only delete your own messages');
  }

  await msgRef.update({ isDeleted: true, text: '[deleted]', gifUrl: null });
  return { success: true };
});

/**
 * pinMessage — admin only.
 */
export const pinMessage = onCall({ memory: '128MiB', maxInstances: 3 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { messageId, pinned } = request.data;
  const collection = 'pvpChat';
  await db.collection(collection).doc(messageId).update({ isPinned: !!pinned });
  return { success: true };
});

/**
 * getChatMessages — returns recent messages, newest last.
 */
export const getChatMessages = onCall({ memory: '128MiB', maxInstances: 10 }, async (request) => {
  const { chatType, matchId, limit: rawLimit } = request.data || {};
  const pageLimit = Math.min(rawLimit || 50, 100);

  const colRef = chatType === 'match'
    ? db.collection('pvpMatches').doc(matchId).collection('chat')
    : db.collection('pvpChat');

  const snap = await colRef
    .where('isDeleted', '==', false)
    .orderBy('timestamp', 'desc')
    .limit(pageLimit)
    .get();

  const messages = snap.docs.map(d => d.data()).reverse();
  return { messages };
});
