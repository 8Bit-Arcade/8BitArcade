/**
 * Get ETH Price - Off-chain price fetching
 *
 * Fetches ETH price from multiple sources with caching to avoid rate limits
 * and provide reliable price data to the frontend.
 */

import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';

// Cache duration: 5 minutes
const CACHE_DURATION_MS = 5 * 60 * 1000;

// Fallback price if all APIs fail
const FALLBACK_ETH_PRICE = 3300;

// CoinGecko API key for higher rate limits
const COINGECKO_API_KEY = 'CG-dcMc86FaS6AMxW5VVecbAx6w';

interface PriceCache {
  price: number;
  timestamp: Timestamp;
  source: string;
}

/**
 * Fetch ETH price from CoinGecko (with API key for better rate limits)
 */
async function fetchFromCoinGecko(): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
      {
        signal: controller.signal,
        headers: {
          'x-cg-demo-api-key': COINGECKO_API_KEY,
        },
      }
    );

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (data?.ethereum?.usd > 0) {
        return data.ethereum.usd;
      }
    }
  } catch (error) {
    logger.warn('CoinGecko fetch failed:', error);
  }
  return null;
}

/**
 * Fetch ETH price from CryptoCompare
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
 * Fetch ETH price from Binance
 */
async function fetchFromBinance(): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(
      'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT',
      { signal: controller.signal }
    );

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      if (data?.price) {
        return parseFloat(data.price);
      }
    }
  } catch (error) {
    logger.warn('Binance fetch failed:', error);
  }
  return null;
}

/**
 * Get cached price from Firestore
 */
async function getCachedPrice(): Promise<PriceCache | null> {
  try {
    const doc = await db.collection('config').doc('ethPrice').get();
    if (doc.exists) {
      return doc.data() as PriceCache;
    }
  } catch (error) {
    logger.warn('Failed to get cached price:', error);
  }
  return null;
}

/**
 * Save price to Firestore cache
 */
async function savePriceToCache(price: number, source: string): Promise<void> {
  try {
    await db.collection('config').doc('ethPrice').set({
      price,
      timestamp: Timestamp.now(),
      source,
    });
  } catch (error) {
    logger.warn('Failed to save price to cache:', error);
  }
}

/**
 * Get ETH Price - Callable function
 *
 * Returns the current ETH price in USD with caching
 */
export const getEthPrice = onCall(
  {
    cors: true,
  },
  async () => {
    logger.info('getEthPrice called');

    // Check cache first
    const cached = await getCachedPrice();
    if (cached) {
      const age = Date.now() - cached.timestamp.toMillis();
      if (age < CACHE_DURATION_MS && cached.price > 0) {
        logger.info(`Using cached ETH price: $${cached.price} (${cached.source})`);
        return {
          price: cached.price,
          source: cached.source,
          cached: true,
          timestamp: cached.timestamp.toMillis(),
        };
      }
    }

    // Try fetching from APIs in order of preference
    let price: number | null = null;
    let source = '';

    // Try CoinGecko first
    price = await fetchFromCoinGecko();
    if (price) {
      source = 'coingecko';
      logger.info(`Fetched ETH price from CoinGecko: $${price}`);
    }

    // Fallback to CryptoCompare
    if (!price) {
      price = await fetchFromCryptoCompare();
      if (price) {
        source = 'cryptocompare';
        logger.info(`Fetched ETH price from CryptoCompare: $${price}`);
      }
    }

    // Fallback to Binance
    if (!price) {
      price = await fetchFromBinance();
      if (price) {
        source = 'binance';
        logger.info(`Fetched ETH price from Binance: $${price}`);
      }
    }

    // If we got a valid price, cache it
    if (price && price > 0) {
      await savePriceToCache(price, source);
      return {
        price,
        source,
        cached: false,
        timestamp: Date.now(),
      };
    }

    // Use cached price even if expired
    if (cached && cached.price > 0) {
      logger.warn(`Using expired cached ETH price: $${cached.price}`);
      return {
        price: cached.price,
        source: cached.source + ' (expired)',
        cached: true,
        timestamp: cached.timestamp.toMillis(),
      };
    }

    // Final fallback
    logger.warn(`Using fallback ETH price: $${FALLBACK_ETH_PRICE}`);
    return {
      price: FALLBACK_ETH_PRICE,
      source: 'fallback',
      cached: false,
      timestamp: Date.now(),
    };
  }
);
