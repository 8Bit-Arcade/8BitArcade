import { useState, useEffect, useCallback } from 'react';

interface EthPriceData {
  price: number;
  cached: boolean;
  cacheAge: number;
  timestamp: number;
}

interface UseEthPriceReturn {
  ethPrice: number | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and track ETH/USD price from our API
 * Automatically refreshes every 15 seconds
 */
export function useEthPrice(): UseEthPriceReturn {
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const fetchPrice = useCallback(async () => {
    try {
      setError(null);

      // Fetch directly from CoinGecko (static export doesn't support API routes)
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&precision=2',
        {
          headers: { 'Accept': 'application/json' },
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

      setEthPrice(price);
      setLastUpdated(Date.now());
      setIsLoading(false);

    } catch (err: any) {
      console.error('Error fetching ETH price:', err);
      setError(err.message || 'Failed to fetch ETH price');
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchPrice();
  }, [fetchPrice]);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPrice();
    }, 15 * 1000); // 15 seconds

    return () => clearInterval(interval);
  }, [fetchPrice]);

  return {
    ethPrice,
    isLoading,
    error,
    lastUpdated,
    refresh: fetchPrice,
  };
}

/**
 * Calculate ETH amount needed for a USD value
 * @param usdAmount Amount in USD
 * @param ethPrice Current ETH price in USD
 * @param buffer Additional percentage buffer (e.g., 0.05 for 5%)
 * @returns ETH amount needed
 */
export function calculateEthAmount(
  usdAmount: number,
  ethPrice: number,
  buffer: number = 0.02 // 2% buffer by default
): number {
  if (ethPrice <= 0) return 0;
  return (usdAmount / ethPrice) * (1 + buffer);
}

/**
 * Format ETH amount for display
 * @param eth ETH amount
 * @param decimals Number of decimal places
 * @returns Formatted string
 */
export function formatEthAmount(eth: number, decimals: number = 6): string {
  return eth.toFixed(decimals);
}

/**
 * Format USD amount for display
 * @param usd USD amount
 * @returns Formatted string
 */
export function formatUsdAmount(usd: number): string {
  return `$${usd.toFixed(2)}`;
}
