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
 * This implements Sign-In with Ethereum (SIWE)
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
      console.log('Attempting to verify signature...');

      // Verify the signature matches the message and address
      const isValid = await verifyMessage({
        address: address as `0x${string}`,
        message,
        signature,
      });

      console.log('Signature verification result:', isValid);

      if (!isValid) {
        console.error('Signature verification failed');
        throw new HttpsError('unauthenticated', 'Invalid signature');
      }

      console.log('Signature verified successfully');

      // Verify the message contains the nonce and hasn't expired
      // Expected format: "Sign in to 8-Bit Arcade\n\nNonce: {random}\nTimestamp: {timestamp}"
      const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
      const timestampMatch = message.match(/Timestamp: (\d+)/);

      if (!nonceMatch || !timestampMatch) {
        console.error('Invalid message format:', message);
        throw new HttpsError('invalid-argument', 'Invalid message format');
      }

      const timestamp = parseInt(timestampMatch[1], 10);
      const now = Date.now();

      // Message must be less than 5 minutes old
      if (now - timestamp > 5 * 60 * 1000) {
        console.error('Message expired:', {
          timestamp,
          now,
          diff: now - timestamp,
        });
        throw new HttpsError('deadline-exceeded', 'Message has expired');
      }

      console.log('Creating custom token for:', address.toLowerCase());

      // Create a custom token for this wallet address
      // The UID will be the lowercase wallet address
      const auth = getAuth();
      const customToken = await auth.createCustomToken(address.toLowerCase());

      console.log('Custom token created successfully');

      // Create or update user document in Firestore
      const userAddress = address.toLowerCase();
      const userRef = collections.users.doc(userAddress);
      const userDoc = await userRef.get();

      if (!userDoc.exists) {
        // Create new user document
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
          flags: {
            count: 0,
            lastFlagged: null,
            reasons: [],
          },
        });
      } else {
        // Update last active timestamp
        await userRef.update({
          lastActive: Timestamp.now(),
        });
      }

      return { customToken };
    } catch (err: any) {
      console.error('Wallet verification error:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
      });

      if (err instanceof HttpsError) {
        throw err;
      }

      // Include more details in the error message
      throw new HttpsError('internal', `Failed to verify wallet signature: ${err.message}`);
    }
  }
);
