import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { recoverMessageAddress } from 'viem';

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

    if (!address || !message || !signature) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    try {
      // Recover the address from the signature
      const recoveredAddress = await recoverMessageAddress({
        message,
        signature,
      });

      // Verify the recovered address matches the claimed address
      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        throw new HttpsError('unauthenticated', 'Signature verification failed');
      }

      // Verify the message contains the nonce and hasn't expired
      // Expected format: "Sign in to 8-Bit Arcade\n\nNonce: {random}\nTimestamp: {timestamp}"
      const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
      const timestampMatch = message.match(/Timestamp: (\d+)/);

      if (!nonceMatch || !timestampMatch) {
        throw new HttpsError('invalid-argument', 'Invalid message format');
      }

      const timestamp = parseInt(timestampMatch[1], 10);
      const now = Date.now();

      // Message must be less than 5 minutes old
      if (now - timestamp > 5 * 60 * 1000) {
        throw new HttpsError('deadline-exceeded', 'Message has expired');
      }

      // Create a custom token for this wallet address
      // The UID will be the lowercase wallet address
      const auth = getAuth();
      const customToken = await auth.createCustomToken(address.toLowerCase());

      return { customToken };
    } catch (err: any) {
      console.error('Wallet verification error:', err);
      if (err instanceof HttpsError) {
        throw err;
      }
      throw new HttpsError('internal', 'Failed to verify wallet signature');
    }
  }
);
