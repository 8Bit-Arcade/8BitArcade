import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { verifyMessage } from 'viem';
import { collections, Timestamp } from '../config/firebase';

interface VerifyWalletRequest {
  address: string;
  message: string;
  signature: `0x${string}`;
}

interface VerifyWalletResponse {
  customToken: string;
}

/**
 * Verify a wallet signature and create a custom Firebase auth token
 * Implements Sign-In with Ethereum (SIWE)
 * Keeps Firestore updates non-blocking to avoid Gateway Timeout
 */
export const verifyWallet = onCall<VerifyWalletRequest, Promise<VerifyWalletResponse>>(
  async (request) => {
    const { address, message, signature } = request.data;

    console.log('verifyWallet called with:', {
      address,
      messageLength: message?.length,
      signatureLength: signature?.length,
    });

    if (!address || !message || !signature) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    try {
      // --- 1. Verify signature ---
      const isValid = await verifyMessage({
        address: address as `0x${string}`,
        message,
        signature,
      });

      if (!isValid) {
        console.error('Signature verification failed');
        throw new HttpsError('unauthenticated', 'Invalid signature');
      }

      console.log('Signature verified successfully');

      // --- 2. Verify timestamp ---
      const timestampMatch = message.match(/Timestamp: (\d+)/);
      if (!timestampMatch) {
        throw new HttpsError('invalid-argument', 'Invalid message format: missing timestamp');
      }

      const timestamp = parseInt(timestampMatch[1], 10);
      const timestampMs = timestamp < 1e12 ? timestamp * 1000 : timestamp; // convert seconds → ms if needed
      const now = Date.now();

      if (now - timestampMs > 10 * 60 * 1000) { // 10 minutes
        console.error('Message expired:', { timestamp: timestampMs, now, diff: now - timestampMs });
        throw new HttpsError('deadline-exceeded', 'Message has expired');
      }

      // --- 3. Create Firebase custom token ---
      const auth = getAuth();
      const customToken = await auth.createCustomToken(address.toLowerCase());
      console.log('Custom token created successfully');

      // --- 4. Firestore updates (non-blocking) ---
      (async () => {
        try {
          const userAddress = address.toLowerCase();
          const userRef = collections.users.doc(userAddress);
          const userDoc = await userRef.get();

          if (!userDoc.exists) {
            console.log('Creating new user document for:', userAddress);
            await userRef.set({
              address: userAddress,
              username: null,
              createdAt: Timestamp.now(),
              lastActive: Timestamp.now(),
              totalGamesPlayed: 0,
              totalScore: 0,
              isBanned: false,
              banReason: null,
              bannedAt: null,
              displayPreference: 'address',
              flags: { count: 0, lastFlagged: null, reasons: [] },
            });
          } else {
            await userRef.update({ lastActive: Timestamp.now() });
          }
        } catch (fsErr) {
          console.error('Firestore async update error:', fsErr);
        }
      })();

      // --- 5. Return token immediately ---
      return { customToken };

    } catch (err: any) {
      console.error('Wallet verification error:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });

      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', `Failed to verify wallet signature: ${err.message}`);
    }
  }
);
