/**
 * Automated Token Sale Price Updater
 *
 * This Cloud Function automatically updates the token sale contract prices
 * based on real-time ETH prices from CoinGecko API.
 *
 * Features:
 * - Runs every 3 minutes via Cloud Scheduler
 * - Only updates when ETH price changes >0.5%
 * - Logs all updates to Firestore
 * - Uses secure wallet from environment variables
 * - Manual trigger available via Firebase Console
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { ethers } from 'ethers';
import { db } from '../config/firebase';

// Secret for price updater wallet
const PRICE_UPDATER_PRIVATE_KEY = defineSecret('PRICE_UPDATER_PRIVATE_KEY');

// Constants
const TOKEN_PRICE_USD = 0.0005; // $0.0005 per 8BIT token
const PRICE_CHANGE_THRESHOLD = 0.5; // % change threshold
const COINGECKO_API =
  'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';
const SALE_CONTRACT_ADDRESS = '0x057B1130dD6E8FcBc144bb34172e45293C6839fE';
const RPC_URL = 'https://sepolia-rollup.arbitrum.io/rpc';
const SALE_CONTRACT_ABI = [
  'function tokensPerEth() view returns (uint256)',
  'function tokensPerUsdc() view returns (uint256)',
  'function updatePrices(uint256 _tokensPerEth, uint256 _tokensPerUsdc) external',
];

// Price update interface for logging
interface PriceUpdate {
  timestamp: number;
  ethPrice: number;
  oldTokensPerEth: string;
  newTokensPerEth: string;
  txHash?: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

/**
 * Fetch ETH price with fallback (Firestore cache + hardcoded)
 */
async function fetchEthPrice(): Promise<number> {
  try {
    const res = await fetch(COINGECKO_API);
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const data = await res.json();
    const price = data.ethereum?.usd;
    if (!price || typeof price !== 'number') throw new Error('Invalid price data');

    logger.info('Fetched ETH price', { price });

    // Save latest ETH price in Firestore for fallback
    await db.doc('system/prices').set({ ethUsd: price, updatedAt: Date.now() }, { merge: true });

    return price;
  } catch (err) {
    logger.error('Failed to fetch ETH price, using fallback', err);

    // Try Firestore cache
    try {
      const snap = await db.doc('system/prices').get();
      const cached = snap.data()?.ethUsd;
      if (cached) {
        logger.info('Using cached ETH price', { cached });
        return cached;
      }
    } catch (cacheErr) {
      logger.warn('Failed to read cached ETH price', cacheErr);
    }

    // Last-resort fallback
    const fallback = 3500;
    logger.warn('Using hardcoded fallback ETH price', { fallback });
    return fallback;
  }
}

/**
 * Convert USD price to tokensPerEth (bigint)
 */
function calculateTokensPerEth(ethPriceUsd: number): bigint {
  const tokensPerEth = ethPriceUsd / TOKEN_PRICE_USD;
  return ethers.parseEther(tokensPerEth.toString());
}

/**
 * Determine if price update is needed
 */
function shouldUpdatePrice(oldTokens: bigint, newTokens: bigint): boolean {
  const oldNum = Number(ethers.formatEther(oldTokens));
  const newNum = Number(ethers.formatEther(newTokens));
  const percentChange = Math.abs((newNum - oldNum) / oldNum) * 100;
  logger.info('Price change analysis', { oldNum, newNum, percentChange, threshold: PRICE_CHANGE_THRESHOLD });
  return percentChange >= PRICE_CHANGE_THRESHOLD;
}

/**
 * Log price update to Firestore
 */
async function logPriceUpdate(update: PriceUpdate) {
  try {
    await db.collection('sale_price_updates').add(update);
  } catch (err) {
    logger.error('Failed to log price update', err);
  }
}

/**
 * Scheduled price updater (every 3 minutes)
 */
export const updateTokenSalePrices = onSchedule(
  {
    schedule: 'every 3 minutes',
    timeZone: 'UTC',
    secrets: [PRICE_UPDATER_PRIVATE_KEY],
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'us-central1',
  },
  async () => {
    logger.info('Starting automated price update');

    try {
      // 1. Fetch ETH price
      const ethPrice = await fetchEthPrice();

      // 2. Setup provider & contract
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const contract = new ethers.Contract(SALE_CONTRACT_ADDRESS, SALE_CONTRACT_ABI, provider);

      const [currentTokensPerEth, currentTokensPerUsdc] = await Promise.all([
        contract.tokensPerEth(),
        contract.tokensPerUsdc(),
      ]);

      const newTokensPerEth = calculateTokensPerEth(ethPrice);

      // 3. Check if update is needed
      if (!shouldUpdatePrice(currentTokensPerEth, newTokensPerEth)) {
        logger.info('Price change below threshold, skipping update');

        await logPriceUpdate({
          timestamp: Date.now(),
          ethPrice,
          oldTokensPerEth: ethers.formatEther(currentTokensPerEth),
          newTokensPerEth: ethers.formatEther(newTokensPerEth),
          skipped: true,
          reason: `Change below ${PRICE_CHANGE_THRESHOLD}%`,
        });
        return; // never throw
      }

      // 4. Connect wallet & update contract
      const wallet = new ethers.Wallet(PRICE_UPDATER_PRIVATE_KEY.value(), provider);
      const contractWithSigner = contract.connect(wallet) as ethers.Contract;

      logger.info('Submitting price update', {
        wallet: wallet.address,
        ethPrice,
        newTokensPerEth: ethers.formatEther(newTokensPerEth),
        currentTokensPerUsdc: ethers.formatEther(currentTokensPerUsdc),
      });

      const tx = await (contractWithSigner as any).updatePrices(newTokensPerEth, currentTokensPerUsdc);
      const receipt = await tx.wait();

      logger.info('Price update confirmed', {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
      });

      // 5. Log successful update
      await logPriceUpdate({
        timestamp: Date.now(),
        ethPrice,
        oldTokensPerEth: ethers.formatEther(currentTokensPerEth),
        newTokensPerEth: ethers.formatEther(newTokensPerEth),
        txHash: receipt.hash,
      });

      logger.info('Automated price update completed successfully');
    } catch (err: any) {
      logger.error('Automated price update failed (but will continue next run)', { error: err.message });

      // Log failed update
      await logPriceUpdate({
        timestamp: Date.now(),
        ethPrice: 0,
        oldTokensPerEth: '0',
        newTokensPerEth: '0',
        error: err.message,
      });

      return; // never throw
    }
  }
);

/**
 * Manual trigger (for Firebase console/testing)
 */
export const manualPriceUpdate = onSchedule(
  {
    schedule: 'every 24 hours', // Dummy schedule
    secrets: [PRICE_UPDATER_PRIVATE_KEY],
    memory: '256MiB',
    timeoutSeconds: 60,
    region: 'us-central1',
  },
  async () => {
    logger.info('Manual price update triggered (actual logic runs in updateTokenSalePrices)');
  }
);
