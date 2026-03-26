/**
 * Diagnostic script to check Telegram data in Firebase
 *
 * Usage: npx ts-node src/diagnose.ts <wallet-address>
 *
 * Checks all three Telegram collections and reports what's found.
 */

import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase
let serviceAccount: ServiceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  const possiblePaths = [
    path.join(__dirname, '../serviceAccountKey.json'),
    path.join(__dirname, '../service-account.json'),
    path.join(__dirname, '../../discord-bot/service-account.json'),
    path.join(__dirname, '../../functions/serviceAccountKey.json'),
  ];
  let foundPath: string | null = null;
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) { foundPath = p; break; }
  }
  if (!foundPath) { console.error('No Firebase service account found!'); process.exit(1); }
  serviceAccount = require(foundPath);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const wallet = process.argv[2]?.toLowerCase();
if (!wallet) {
  console.error('Usage: npx ts-node src/diagnose.ts <wallet-address>');
  process.exit(1);
}

async function diagnose() {
  console.log(`\n🔍 Diagnosing Telegram data for wallet: ${wallet}\n`);

  // 1. Check telegram_links (query by walletAddress)
  console.log('=== telegram_links (query walletAddress == wallet) ===');
  const linksQuery = await db.collection('telegram_links')
    .where('walletAddress', '==', wallet)
    .limit(5)
    .get();

  if (linksQuery.empty) {
    console.log('  ❌ NO DOCUMENT FOUND');
    console.log('  → This means /link has NOT been run for this wallet');
    console.log('  → The airdrop page CANNOT find your Telegram data\n');

    // Also check all telegram_links docs to see what wallets exist
    console.log('=== All telegram_links documents ===');
    const allLinks = await db.collection('telegram_links').get();
    if (allLinks.empty) {
      console.log('  ❌ Collection is EMPTY - no one has linked yet');
    } else {
      console.log(`  Found ${allLinks.size} link(s):`);
      for (const doc of allLinks.docs) {
        const data = doc.data();
        console.log(`  - telegramId: ${doc.id}, wallet: ${data.walletAddress}, user: ${data.username}`);
      }
    }
  } else {
    for (const doc of linksQuery.docs) {
      const data = doc.data();
      console.log(`  ✅ FOUND — telegramId: ${doc.id}`);
      console.log(`     walletAddress: ${data.walletAddress}`);
      console.log(`     username: ${data.username}`);
      console.log(`     linkedAt: ${data.linkedAt?.toDate?.() || data.linkedAt}`);

      // 2. Check telegram_activity for this telegramId
      console.log(`\n=== telegram_activity/${doc.id} ===`);
      const activityDoc = await db.collection('telegram_activity').doc(doc.id).get();
      if (activityDoc.exists) {
        const activity = activityDoc.data();
        console.log(`  ✅ FOUND`);
        console.log(`     messageCount: ${activity?.messageCount}`);
        console.log(`     username: ${activity?.username}`);
        console.log(`     lastMessage: ${activity?.lastMessage?.toDate?.() || activity?.lastMessage}`);
        console.log(`     chatId: ${activity?.chatId}`);
        if (activity?.importedFromHistory) {
          console.log(`     importedFromHistory: true`);
          console.log(`     importedAt: ${activity?.importedAt?.toDate?.() || activity?.importedAt}`);
        }
      } else {
        console.log(`  ❌ NO DOCUMENT — no messages tracked for this telegramId`);
        console.log(`  → Bot may not have tracked any group messages yet`);
        console.log(`  → Check: is privacy mode disabled? Is the bot in the group?`);
      }
    }
  }

  // 3. Check telegram_users (old collection, keyed by wallet)
  console.log(`\n=== telegram_users/${wallet} (legacy collection) ===`);
  const usersDoc = await db.collection('telegram_users').doc(wallet).get();
  if (usersDoc.exists) {
    const data = usersDoc.data();
    console.log(`  Found (legacy) — messageCount: ${data?.messageCount}, username: ${data?.username}`);
  } else {
    console.log(`  Not found (this is OK — we use telegram_links + telegram_activity now)`);
  }

  // 4. Check if any airdrop snapshots exist
  console.log(`\n=== Airdrop snapshots ===`);
  const airdrops = await db.collection('airdrops').get();
  if (airdrops.empty) {
    console.log('  No snapshots — public page uses calculateRealTimeEligibility (good)');
  } else {
    console.log(`  Found ${airdrops.size} snapshot(s):`);
    for (const doc of airdrops.docs) {
      const data = doc.data();
      console.log(`  - ${doc.id}: status=${data.status}, created=${data.createdAt?.toDate?.()}`);

      // Check if this wallet has an allocation in this snapshot
      const allocDoc = await db.collection('airdrops').doc(doc.id).collection('allocations').doc(wallet).get();
      if (allocDoc.exists) {
        console.log(`    ⚠️ Wallet IS in this snapshot — getAirdropStatus uses SNAPSHOT data (no live Telegram)`);
        console.log(`    → Snapshot data: points=${allocDoc.data()?.points}, tier=${allocDoc.data()?.tier}`);
      } else {
        console.log(`    Wallet NOT in this snapshot — falls through to real-time calculation`);
      }
    }
  }

  console.log('\n✅ Diagnosis complete\n');
}

diagnose().catch(err => {
  console.error('Diagnosis failed:', err);
  process.exit(1);
});
