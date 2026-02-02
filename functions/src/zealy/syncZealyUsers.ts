import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';

const db = getFirestore();

// Define secret for Zealy API key (set via Firebase CLI: firebase functions:secrets:set ZEALY_API_KEY)
const zealyApiKey = defineSecret('ZEALY_API_KEY');

// Your Zealy community subdomain
const ZEALY_SUBDOMAIN = '8bit-arcade';

interface ZealyUser {
  id: string;
  name: string;
  xp: number;
  rank: number;
  questsCompleted?: number;
  connectedWallet?: string;
  discordId?: string;
  twitterId?: string;
}

/**
 * Fetch users from Zealy API
 */
async function fetchZealyLeaderboard(apiKey: string, page = 1, limit = 100): Promise<ZealyUser[]> {
  const url = `https://api.zealy.io/communities/${ZEALY_SUBDOMAIN}/leaderboard?page=${page}&limit=${limit}`;

  console.log(`Fetching Zealy leaderboard page ${page}...`);

  const response = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zealy API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Debug: Log raw response structure on first page
  if (page === 1) {
    console.log('Zealy API response keys:', Object.keys(data));
    if (data.data && data.data.length > 0) {
      console.log('First user structure:', JSON.stringify(data.data[0], null, 2));
    } else if (data.leaderboard && data.leaderboard.length > 0) {
      console.log('First user structure:', JSON.stringify(data.leaderboard[0], null, 2));
    }
  }

  // Handle different response formats from Zealy API
  const users = data.leaderboard || data.data || [];

  // Map to our expected structure (Zealy might use different field names)
  return users.map((u: any) => ({
    id: u.id || u.userId || u._id || u.user?.id || '',
    name: u.name || u.username || u.displayName || u.user?.name || '',
    xp: u.xp || u.points || u.score || 0,
    rank: u.rank || u.position || 0,
    questsCompleted: u.questsCompleted || u.completedQuests || 0,
    connectedWallet: u.connectedWallet || u.wallet || u.address || u.ethAddress || null,
    discordId: u.discordId || u.discord?.id || null,
    twitterId: u.twitterId || u.twitter?.id || null,
  }));
}

/**
 * Fetch a specific user by their Zealy ID
 */
async function fetchZealyUser(apiKey: string, userId: string): Promise<ZealyUser | null> {
  const url = `https://api.zealy.io/communities/${ZEALY_SUBDOMAIN}/users/${userId}`;

  const response = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    const errorText = await response.text();
    throw new Error(`Zealy API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Sync all Zealy users to Firebase
 * This function fetches the Zealy leaderboard and stores user data
 */
export const syncZealyUsers = onCall(
  { secrets: [zealyApiKey] },
  async (request) => {
    // Admin check
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const ADMIN_WALLETS = [
      '0x96e0b627454ce3b8c55c6d36b5fcbb13849dc297',
    ];

    if (!ADMIN_WALLETS.includes(request.auth.uid.toLowerCase())) {
      throw new HttpsError('permission-denied', 'Only admins can sync Zealy data');
    }

    const apiKey = zealyApiKey.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'Zealy API key not configured. Set it with: firebase functions:secrets:set ZEALY_API_KEY');
    }

    console.log('🎯 Starting Zealy user sync...');

    try {
      let allUsers: ZealyUser[] = [];
      let page = 1;
      let hasMore = true;

      // Fetch all pages
      while (hasMore) {
        const users = await fetchZealyLeaderboard(apiKey, page, 100);
        if (users.length === 0) {
          hasMore = false;
        } else {
          allUsers = [...allUsers, ...users];
          page++;
          // Safety limit
          if (page > 50) break;
        }
      }

      console.log(`📊 Fetched ${allUsers.length} users from Zealy`);

      // Store in Firebase
      let synced = 0;
      let withWallet = 0;
      let skipped = 0;

      const batch = db.batch();

      for (const user of allUsers) {
        // Skip users with empty or invalid IDs
        if (!user.id || typeof user.id !== 'string' || user.id.trim() === '') {
          console.log(`   Skipping user with invalid ID:`, user);
          skipped++;
          continue;
        }

        // Store by Zealy ID
        const zealyRef = db.collection('zealy_users_by_id').doc(user.id);
        batch.set(zealyRef, {
          zealyId: user.id,
          name: user.name || 'Unknown',
          xp: user.xp || 0,
          rank: user.rank || 0,
          questsCompleted: user.questsCompleted || 0,
          connectedWallet: user.connectedWallet || null,
          discordId: user.discordId || null,
          twitterId: user.twitterId || null,
          lastSynced: FieldValue.serverTimestamp(),
        }, { merge: true });

        // If user has connected wallet, also store by wallet
        if (user.connectedWallet && typeof user.connectedWallet === 'string' && user.connectedWallet.trim() !== '') {
          const walletAddress = user.connectedWallet.toLowerCase().trim();
          if (walletAddress.startsWith('0x') && walletAddress.length === 42) {
            const walletRef = db.collection('zealy_users').doc(walletAddress);
            batch.set(walletRef, {
              zealyId: user.id,
              name: user.name || 'Unknown',
              xp: user.xp || 0,
              rank: user.rank || 0,
              questsCompleted: user.questsCompleted || 0,
              lastSynced: FieldValue.serverTimestamp(),
            }, { merge: true });
            withWallet++;
          }
        }

        synced++;
      }

      await batch.commit();

      console.log(`✅ Zealy sync complete: ${synced} users synced, ${withWallet} with connected wallets, ${skipped} skipped`);

      return {
        success: true,
        totalUsers: synced,
        usersWithWallet: withWallet,
        message: `Synced ${synced} Zealy users (${withWallet} with connected wallets)`,
      };
    } catch (error) {
      console.error('❌ Zealy sync error:', error);
      throw new HttpsError('internal', `Zealy sync failed: ${error}`);
    }
  }
);

/**
 * Scheduled sync - runs daily at 6 AM UTC
 */
export const scheduledZealySync = onSchedule(
  {
    schedule: '0 6 * * *',
    timeZone: 'UTC',
    secrets: [zealyApiKey],
  },
  async () => {
    const apiKey = zealyApiKey.value();
    if (!apiKey) {
      console.error('Zealy API key not configured');
      return;
    }

    console.log('🎯 Running scheduled Zealy sync...');

    try {
      let allUsers: ZealyUser[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const users = await fetchZealyLeaderboard(apiKey, page, 100);
        if (users.length === 0) {
          hasMore = false;
        } else {
          allUsers = [...allUsers, ...users];
          page++;
          if (page > 50) break;
        }
      }

      console.log(`📊 Fetched ${allUsers.length} users from Zealy`);

      let synced = 0;
      let withWallet = 0;
      const batch = db.batch();

      for (const user of allUsers) {
        // Skip users with empty or invalid IDs
        if (!user.id || typeof user.id !== 'string' || user.id.trim() === '') {
          continue;
        }

        const zealyRef = db.collection('zealy_users_by_id').doc(user.id);
        batch.set(zealyRef, {
          zealyId: user.id,
          name: user.name || 'Unknown',
          xp: user.xp || 0,
          rank: user.rank || 0,
          questsCompleted: user.questsCompleted || 0,
          connectedWallet: user.connectedWallet || null,
          discordId: user.discordId || null,
          twitterId: user.twitterId || null,
          lastSynced: FieldValue.serverTimestamp(),
        }, { merge: true });

        if (user.connectedWallet && typeof user.connectedWallet === 'string' && user.connectedWallet.trim() !== '') {
          const walletAddress = user.connectedWallet.toLowerCase().trim();
          if (walletAddress.startsWith('0x') && walletAddress.length === 42) {
            const walletRef = db.collection('zealy_users').doc(walletAddress);
            batch.set(walletRef, {
              zealyId: user.id,
              name: user.name || 'Unknown',
              xp: user.xp || 0,
              rank: user.rank || 0,
              questsCompleted: user.questsCompleted || 0,
              lastSynced: FieldValue.serverTimestamp(),
            }, { merge: true });
            withWallet++;
          }
        }
        synced++;
      }

      await batch.commit();

      // Log sync result
      await db.collection('system').doc('zealy_sync').set({
        lastSync: FieldValue.serverTimestamp(),
        totalUsers: synced,
        usersWithWallet: withWallet,
      });

      console.log(`✅ Scheduled Zealy sync complete: ${synced} users, ${withWallet} with wallets`);
    } catch (error) {
      console.error('❌ Scheduled Zealy sync error:', error);
    }
  }
);

/**
 * Webhook endpoint for Zealy to call when users complete quests
 * Configure this URL in Zealy dashboard under Webhooks
 */
export const zealyWebhook = onRequest(
  { cors: true },
  async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    try {
      const { userId, xp, questId, wallet } = req.body;

      if (!userId) {
        res.status(400).json({ error: 'Missing userId' });
        return;
      }

      console.log(`📥 Zealy webhook: user ${userId} completed quest ${questId}, XP: ${xp}`);

      // Update user data
      const zealyRef = db.collection('zealy_users_by_id').doc(userId);
      await zealyRef.set({
        zealyId: userId,
        xp: xp || 0,
        lastQuestCompleted: questId,
        lastUpdated: FieldValue.serverTimestamp(),
      }, { merge: true });

      // If wallet provided, also update wallet-indexed collection
      if (wallet) {
        const walletRef = db.collection('zealy_users').doc(wallet.toLowerCase());
        await walletRef.set({
          zealyId: userId,
          xp: xp || 0,
          lastUpdated: FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Zealy webhook error:', error);
      res.status(500).json({ error: 'Internal error' });
    }
  }
);

/**
 * Manual link: Connect a wallet to a Zealy user
 * Call this when a user verifies their wallet on your platform
 */
export const linkZealyWallet = onCall(
  { secrets: [zealyApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const { zealyUserId } = request.data as { zealyUserId?: string };
    const wallet = request.auth.uid.toLowerCase();

    if (!zealyUserId) {
      throw new HttpsError('invalid-argument', 'Zealy user ID required');
    }

    const apiKey = zealyApiKey.value();
    if (!apiKey) {
      throw new HttpsError('failed-precondition', 'Zealy API key not configured');
    }

    try {
      // Fetch user from Zealy to verify they exist
      const zealyUser = await fetchZealyUser(apiKey, zealyUserId);

      if (!zealyUser) {
        throw new HttpsError('not-found', 'Zealy user not found');
      }

      // Store the link
      const walletRef = db.collection('zealy_users').doc(wallet);
      await walletRef.set({
        zealyId: zealyUserId,
        name: zealyUser.name,
        xp: zealyUser.xp,
        rank: zealyUser.rank,
        questsCompleted: zealyUser.questsCompleted || 0,
        linkedAt: FieldValue.serverTimestamp(),
        lastSynced: FieldValue.serverTimestamp(),
      });

      // Also update the by-ID collection with wallet
      const zealyRef = db.collection('zealy_users_by_id').doc(zealyUserId);
      await zealyRef.set({
        connectedWallet: wallet,
      }, { merge: true });

      console.log(`✅ Linked wallet ${wallet} to Zealy user ${zealyUserId}`);

      return {
        success: true,
        xp: zealyUser.xp,
        rank: zealyUser.rank,
      };
    } catch (error) {
      console.error('Error linking Zealy wallet:', error);
      throw new HttpsError('internal', `Failed to link wallet: ${error}`);
    }
  }
);
