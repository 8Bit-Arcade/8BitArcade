import { NextResponse } from 'next/server';

/**
 * ETH Price API - Fetches current ETH/USD price from CoinGecko
 * Implements server-side caching for 15 seconds to avoid rate limiting
 * and reduce API calls
 */

interface PriceCache {
  price: number;
  timestamp: number;
}

// Server-side cache (persists across requests in same Node process)
let priceCache: PriceCache | null = null;
const CACHE_DURATION_MS = 15 * 1000; // 15 seconds

/**
 * Get ETH price from CoinGecko or cache
 */
async function getEthPrice(): Promise<number> {
  const now = Date.now();

  // Check if cache is valid
  if (priceCache && (now - priceCache.timestamp) < CACHE_DURATION_MS) {
    console.log(`[ETH Price] Using cached price: $${priceCache.price}`);
    return priceCache.price;
  }

  // Fetch fresh price from CoinGecko
  try {
    console.log('[ETH Price] Fetching fresh price from CoinGecko...');

    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&precision=2',
      {
        headers: {
          'Accept': 'application/json',
        },
        // Don't cache on client side - we handle caching server-side
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const price = data.ethereum?.usd;

    if (typeof price !== 'number' || price <= 0) {
      throw new Error('Invalid price data from CoinGecko');
    }

    // Update cache
    priceCache = {
      price,
      timestamp: now,
    };

    console.log(`[ETH Price] Fetched fresh price: $${price}`);
    return price;

  } catch (error) {
    console.error('[ETH Price] Error fetching from CoinGecko:', error);

    // If fetch fails but we have stale cache (< 5 minutes old), use it
    if (priceCache && (now - priceCache.timestamp) < 5 * 60 * 1000) {
      console.log(`[ETH Price] Using stale cache due to error: $${priceCache.price}`);
      return priceCache.price;
    }

    // No cache available, throw error
    throw new Error('Failed to fetch ETH price and no cache available');
  }
}

/**
 * GET /api/eth-price
 * Returns current ETH/USD price with cache info
 */
export async function GET() {
  try {
    const price = await getEthPrice();
    const cacheAge = priceCache ? Date.now() - priceCache.timestamp : 0;

    return NextResponse.json({
      success: true,
      price,
      cached: cacheAge > 0 && cacheAge < CACHE_DURATION_MS,
      cacheAge: Math.floor(cacheAge / 1000), // seconds
      timestamp: Date.now(),
    });

  } catch (error: any) {
    console.error('[ETH Price] API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch ETH price',
      },
      { status: 500 }
    );
  }
}

/**
 * Set cache headers to allow client-side caching for 15 seconds
 */
export const revalidate = 15; // Next.js will revalidate every 15 seconds
