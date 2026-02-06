/**
 * Import Telegram Chat History into Firebase
 *
 * This script reads a Telegram Desktop chat export (JSON format)
 * and populates telegram_activity in Firebase with historical message counts.
 *
 * HOW TO EXPORT FROM TELEGRAM DESKTOP:
 * 1. Open Telegram Desktop (NOT mobile or web)
 * 2. Open your group chat
 * 3. Click the three dots menu (top right) → "Export Chat History"
 * 4. Select ONLY "Text messages" (uncheck photos, videos, etc.)
 * 5. Format: "Machine-readable JSON"
 * 6. Path: save to this telegram-bot folder
 * 7. Click "Export"
 * 8. The export creates a folder with result.json inside it
 *
 * USAGE:
 *   npx ts-node src/importHistory.ts ./ChatExport/result.json
 *
 * This will:
 * - Count all messages per user from the export
 * - Update telegram_activity/{telegramId} with the total messageCount
 * - Print a summary of all users and their message counts
 */

import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
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
    if (fs.existsSync(p)) {
      foundPath = p;
      break;
    }
  }

  if (!foundPath) {
    console.error('ERROR: Firebase service account not found!');
    process.exit(1);
  }

  serviceAccount = require(foundPath);
  console.log(`Using Firebase service account from: ${foundPath}`);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Get export file path from command line
const exportFilePath = process.argv[2];

if (!exportFilePath) {
  console.error('Usage: npx ts-node src/importHistory.ts <path-to-result.json>');
  console.error('');
  console.error('Export your chat from Telegram Desktop first:');
  console.error('  Open group → Three dots → Export Chat History → JSON format');
  process.exit(1);
}

const resolvedPath = path.resolve(exportFilePath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`File not found: ${resolvedPath}`);
  process.exit(1);
}

interface TelegramMessage {
  id: number;
  type: string;
  date: string;
  from?: string;
  from_id?: string;
  text?: string | Array<{ type: string; text: string }>;
}

interface TelegramExport {
  name: string;
  type: string;
  id: number;
  messages: TelegramMessage[];
}

async function importHistory() {
  console.log(`\nReading export file: ${resolvedPath}`);

  const raw = fs.readFileSync(resolvedPath, 'utf-8');
  const data: TelegramExport = JSON.parse(raw);

  console.log(`Chat: ${data.name} (${data.type})`);
  console.log(`Total messages in export: ${data.messages.length}`);

  // Count messages per user
  const userCounts: Map<string, { count: number; username: string; lastDate: string }> = new Map();

  for (const msg of data.messages) {
    // Skip non-message types (service messages, etc.)
    if (msg.type !== 'message') continue;

    // from_id format is "userXXXXXXX" — extract the numeric ID
    if (!msg.from_id) continue;
    const telegramId = msg.from_id.replace('user', '');

    if (!telegramId || telegramId === '') continue;

    const existing = userCounts.get(telegramId);
    if (existing) {
      existing.count++;
      existing.lastDate = msg.date;
    } else {
      userCounts.set(telegramId, {
        count: 1,
        username: msg.from || 'Unknown',
        lastDate: msg.date,
      });
    }
  }

  console.log(`\nFound ${userCounts.size} unique users:\n`);

  // Sort by message count descending
  const sorted = Array.from(userCounts.entries())
    .sort((a, b) => b[1].count - a[1].count);

  for (const [userId, data] of sorted) {
    console.log(`  ${data.username.padEnd(25)} (${userId.padEnd(12)}) — ${data.count} messages`);
  }

  // Confirm before writing
  console.log(`\nThis will update telegram_activity for ${userCounts.size} users in Firebase.`);
  console.log('Writing to Firebase...\n');

  // Write to Firebase
  const batch_size = 500; // Firestore batch limit
  let processed = 0;

  const entries = Array.from(userCounts.entries());

  for (let i = 0; i < entries.length; i += batch_size) {
    const batch = db.batch();
    const chunk = entries.slice(i, i + batch_size);

    for (const [telegramId, userData] of chunk) {
      const ref = db.collection('telegram_activity').doc(telegramId);
      batch.set(ref, {
        odedId: telegramId,
        username: userData.username,
        messageCount: userData.count,
        lastMessage: new Date(userData.lastDate),
        importedFromHistory: true,
        importedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    await batch.commit();
    processed += chunk.length;
    console.log(`  Written ${processed}/${entries.length} users`);
  }

  console.log(`\n✅ Import complete! ${processed} users updated in telegram_activity.`);
  console.log('\nNext steps:');
  console.log('  1. Users still need to /link their wallet in the bot');
  console.log('  2. Once linked, their historical message count will appear on the airdrop page');
  console.log('  3. New messages will continue to increment the count');
}

importHistory().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
