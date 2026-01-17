/**
 * Off-Chain ETH Price Endpoint
 *
 * Returns current ETH price from Firestore cache (updated every 3 min)
 * or fetches fresh from CoinGecko if cache is stale.
 *
 * This allows the frontend to calculate token amounts WITHOUT on-chain calls.
 */

import { onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import { db } from '../config/firebase';

const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';
const TOKEN_PRICE_USD = 0.0005; // $0.0005 per 8BIT token
const CACHE_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

interface EthPriceResponse {
  ethPriceUsd: number;
  tokensPerEth: number;
  tokenPriceUsd: number;
  updatedAt: number;
  source: 'cache' | 'fresh' | 'fallback';
}

/**
 * Get current ETH price (off-chain)
 * Returns ETH price and calculated tokensPerEth for frontend use
 */
export const getEthPrice = onCall(
  { cors: true },
  async (): Promise<EthPriceResponse> => {
    try {
      // 1. Try Firestore cache first
      const priceDoc = await db.doc('system/prices').get();
      const cached = priceDoc.data();

      if (cached?.ethUsd && cached?.updatedAt) {
        const age = Date.now() - cached.updatedAt;

        // If cache is fresh enough, use it
        if (age < CACHE_MAX_AGE_MS) {
          const tokensPerEth = cached.ethUsd / TOKEN_PRICE_USD;
          logger.info('Returning cached ETH price', {
            ethUsd: cached.ethUsd,
            age: Math.round(age / 1000) + 's'
          });

          return {
            ethPriceUsd: cached.ethUsd,
            tokensPerEth,
            tokenPriceUsd: TOKEN_PRICE_USD,
            updatedAt: cached.updatedAt,
            source: 'cache',
          };
        }
      }

      // 2. Cache stale or missing - fetch fresh
      logger.info('Fetching fresh ETH price from CoinGecko');
      const res = await fetch(COINGECKO_API);

      if (!res.ok) {
        throw new Error(`CoinGecko HTTP ${res.status}`);
      }

      const data = await res.json();
      const ethPrice = data.ethereum?.usd;

      if (!ethPrice || typeof ethPrice !== 'number') {
        throw new Error('Invalid price data from CoinGecko');
      }

      // 3. Update cache
      const now = Date.now();
      await db.doc('system/prices').set({
        ethUsd: ethPrice,
        updatedAt: now
      }, { merge: true });

      const tokensPerEth = ethPrice / TOKEN_PRICE_USD;

      logger.info('Returning fresh ETH price', { ethPrice, tokensPerEth });

      return {
        ethPriceUsd: ethPrice,
        tokensPerEth,
        tokenPriceUsd: TOKEN_PRICE_USD,
        updatedAt: now,
        source: 'fresh',
      };

    } catch (error) {
      logger.error('Failed to get ETH price, using fallback', error);

      // 4. Fallback: try cache even if stale
      try {
        const priceDoc = await db.doc('system/prices').get();
        const cached = priceDoc.data();

        if (cached?.ethUsd) {
          const tokensPerEth = cached.ethUsd / TOKEN_PRICE_USD;
          return {
            ethPriceUsd: cached.ethUsd,
            tokensPerEth,
            tokenPriceUsd: TOKEN_PRICE_USD,
            updatedAt: cached.updatedAt || Date.now(),
            source: 'cache',
          };
        }
      } catch {
        // Ignore cache error
      }

      // 5. Last resort hardcoded fallback
      const fallbackEth = 3500;
      const tokensPerEth = fallbackEth / TOKEN_PRICE_USD;

      return {
        ethPriceUsd: fallbackEth,
        tokensPerEth,
        tokenPriceUsd: TOKEN_PRICE_USD,
        updatedAt: Date.now(),
        source: 'fallback',
      };
    }
  }
);
