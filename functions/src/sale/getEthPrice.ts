/**
 * Get ETH Price - Off-chain price fetching
 *
 * Fetches ETH price from CoinGecko with caching (15 second minimum).
 * Calculates tokensPerEth and tokensPerUsdc based on $0.0005/token price.
 * Writes to system/prices for the sale page to read.
 */

import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';

// Cache duration: 15 seconds (as requested)
const CACHE_DURATION_MS = 15 * 1000;

// Token price in USD
const TOKEN_PRICE_USD = 0.0005;

// USDC is always $1, so tokensPerUsdc is fixed
const TOKENS_PER_USDC = 1 / TOKEN_PRICE_USD; // 2000

// Fallback ETH price if all APIs fail
const FALLBACK_ETH_PRICE = 3300;

// CoinGecko API (free tier, no key needed for basic calls)
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';

interface PriceData {
  ethUsd: number;
  tokensPerEth: number;
  tokensPerUsdc: number;
  updatedAt: Timestamp;
  source: string;
}

/**
 * Fetch ETH price from CoinGecko
 */
async function fetchEthPrice(): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(COINGECKO_API, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (data?.ethereum?.usd > 0) {
        return data.ethereum.usd;
      }
    } else {
      logger.warn('CoinGecko API error:', response.status, response.statusText);
    }
  } catch (error) {
    logger.warn('CoinGecko fetch failed:', error);
  }
  return null;
}

/**
 * Fetch from CryptoCompare as backup
 */
async function fetchFromCryptoCompare(): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      'https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD',
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (data?.USD > 0) {
        return data.USD;
      }
    }
  } catch (error) {
    logger.warn('CryptoCompare fetch failed:', error);
  }
  return null;
}

/**
 * Get cached price from Firestore
 */
async function getCachedPrice(): Promise<PriceData | null> {
  try {
    const doc = await db.doc('system/prices').get();
    if (doc.exists) {
      return doc.data() as PriceData;
    }
  } catch (error) {
    logger.warn('Failed to get cached price:', error);
  }
  return null;
}

/**
 * Save price data to Firestore (system/prices)
 */
async function savePriceData(ethUsd: number, source: string): Promise<PriceData> {
  const tokensPerEth = ethUsd / TOKEN_PRICE_USD;

  const priceData: PriceData = {
    ethUsd,
    tokensPerEth,
    tokensPerUsdc: TOKENS_PER_USDC,
    updatedAt: Timestamp.now(),
    source,
  };

  try {
    await db.doc('system/prices').set(priceData);
    logger.info('Saved price data to system/prices', {
      ethUsd,
      tokensPerEth,
      tokensPerUsdc: TOKENS_PER_USDC,
      source,
    });
  } catch (error) {
    logger.error('Failed to save price data:', error);
  }

  return priceData;
}

/**
 * Core logic to update prices (used by both callable and scheduled functions)
 */
async function updatePricesCore(forceRefresh = false): Promise<PriceData> {
  // Check cache first (unless forcing refresh)
  if (!forceRefresh) {
    const cached = await getCachedPrice();
    if (cached && cached.updatedAt) {
      const age = Date.now() - cached.updatedAt.toMillis();
      if (age < CACHE_DURATION_MS && cached.tokensPerEth > 0) {
        logger.info(`Using cached price: $${cached.ethUsd} (age: ${Math.round(age / 1000)}s)`);
        return cached;
      }
    }
  }

  // Fetch fresh price from CoinGecko
  let ethPrice = await fetchEthPrice();
  let source = 'coingecko';

  // Fallback to CryptoCompare
  if (!ethPrice) {
    ethPrice = await fetchFromCryptoCompare();
    source = 'cryptocompare';
  }

  // If we got a valid price, save it
  if (ethPrice && ethPrice > 0) {
    return await savePriceData(ethPrice, source);
  }

  // Try to use expired cache
  const cached = await getCachedPrice();
  if (cached && cached.ethUsd > 0) {
    logger.warn(`Using expired cached price: $${cached.ethUsd}`);
    return cached;
  }

  // Final fallback - use hardcoded price
  logger.warn(`Using fallback ETH price: $${FALLBACK_ETH_PRICE}`);
  return await savePriceData(FALLBACK_ETH_PRICE, 'fallback');
}

/**
 * Get ETH Price - Callable function
 *
 * Returns current price data including tokensPerEth and tokensPerUsdc.
 * Automatically refreshes if cache is stale (>15 seconds).
 */
export const getEthPrice = onCall(
  {
    cors: true,
    region: 'us-central1',
  },
  async () => {
    logger.info('getEthPrice called');

    try {
      const priceData = await updatePricesCore();

      return {
        ethUsd: priceData.ethUsd,
        tokensPerEth: priceData.tokensPerEth,
        tokensPerUsdc: priceData.tokensPerUsdc,
        source: priceData.source,
        timestamp: priceData.updatedAt.toMillis(),
      };
    } catch (error) {
      logger.error('getEthPrice handler error:', error);
      // Return fallback instead of 500-ing
      return {
        ethUsd: FALLBACK_ETH_PRICE,
        tokensPerEth: FALLBACK_ETH_PRICE / TOKEN_PRICE_USD,
        tokensPerUsdc: TOKENS_PER_USDC,
        source: 'fallback',
        timestamp: Date.now(),
      };
    }
  }
);

/**
 * Scheduled Price Updater - Runs every minute
 *
 * Keeps prices fresh so users don't have to wait for the first call.
 * Only actually fetches from API if cache is stale (>15 seconds).
 */
export const scheduledPriceUpdate = onSchedule(
  {
    schedule: 'every 1 minutes',
    timeZone: 'UTC',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async () => {
    logger.info('Scheduled price update running');

    try {
      const priceData = await updatePricesCore();
      logger.info('Scheduled update complete', {
        ethUsd: priceData.ethUsd,
        tokensPerEth: priceData.tokensPerEth,
        source: priceData.source,
      });
    } catch (error) {
      logger.error('Scheduled price update failed:', error);
    }
  }
);
