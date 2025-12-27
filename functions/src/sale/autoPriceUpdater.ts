/**
 * Automated Token Sale Price Updater
 *
 * This Cloud Function automatically updates the token sale contract prices
 * based on real-time ETH prices from CoinGecko API.
 *
 * Features:
 * - Runs every 15 minutes via Cloud Scheduler
 * - Only updates when ETH price changes >5% (saves gas)
 * - Logs all updates to Firestore for tracking
 * - Uses secure wallet from environment variables
 *
 * Setup Requirements:
 * 1. Create a dedicated "price updater" wallet
 * 2. Transfer ~0.01 ETH for gas to that wallet
 * 3. Set environment variable: PRICE_UPDATER_PRIVATE_KEY
 *    Run: firebase functions:secrets:set PRICE_UPDATER_PRIVATE_KEY
 * 4. Make the wallet an authorized price updater on the contract
 *    (or use owner wallet if contract has no separate updater role)
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import { defineSecret } from 'firebase-functions/params';
import { ethers } from 'ethers';
import { firestore } from '../config/firebase';

// Define the secret for the private key
const PRICE_UPDATER_PRIVATE_KEY = defineSecret('PRICE_UPDATER_PRIVATE_KEY');

// Constants
const TOKEN_PRICE_USD = 0.0005; // $0.0005 per 8BIT token
const PRICE_CHANGE_THRESHOLD = 5; // Only update if price changed >5%
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';

// Contract configuration (Arbitrum Sepolia Testnet)
const SALE_CONTRACT_ADDRESS = '0x057B1130dD6E8FcBc144bb34172e45293C6839fE';
const RPC_URL = 'https://sepolia-rollup.arbitrum.io/rpc';

const SALE_CONTRACT_ABI = [
  'function tokensPerEth() view returns (uint256)',
  'function tokensPerUsdc() view returns (uint256)',
  'function updatePrices(uint256 _tokensPerEth, uint256 _tokensPerUsdc) external',
];

interface PriceUpdate {
  timestamp: number;
  ethPrice: number;
  oldTokensPerEth: string;
  newTokensPerEth: string;
  txHash?: string;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Fetch current ETH price from CoinGecko
 */
async function fetchEthPrice(): Promise<number> {
  try {
    const response = await fetch(COINGECKO_API);

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const price = data.ethereum.usd;

    if (!price || typeof price !== 'number') {
      throw new Error('Invalid price data from CoinGecko');
    }

    logger.info('Fetched ETH price from CoinGecko', { price });
    return price;
  } catch (error) {
    logger.error('Failed to fetch ETH price', { error });
    throw error;
  }
}

/**
 * Calculate tokens per ETH based on USD price
 */
function calculateTokensPerEth(ethPriceUsd: number): bigint {
  const tokensPerEth = ethPriceUsd / TOKEN_PRICE_USD;
  // Convert to wei (18 decimals)
  return ethers.parseEther(tokensPerEth.toString());
}

/**
 * Check if price changed enough to warrant an update
 */
function shouldUpdatePrice(oldTokens: bigint, newTokens: bigint): boolean {
  const oldNum = Number(ethers.formatEther(oldTokens));
  const newNum = Number(ethers.formatEther(newTokens));

  const percentChange = Math.abs((newNum - oldNum) / oldNum) * 100;

  logger.info('Price change analysis', {
    oldTokens: oldNum,
    newTokens: newNum,
    percentChange: percentChange.toFixed(2),
    threshold: PRICE_CHANGE_THRESHOLD,
  });

  return percentChange >= PRICE_CHANGE_THRESHOLD;
}

/**
 * Log price update to Firestore
 */
async function logPriceUpdate(update: PriceUpdate): Promise<void> {
  try {
    await firestore.collection('sale_price_updates').add(update);
    logger.info('Price update logged to Firestore');
  } catch (error) {
    logger.error('Failed to log price update', { error });
  }
}

/**
 * Scheduled function to auto-update token sale prices
 * Runs every 15 minutes
 */
export const updateTokenSalePrices = onSchedule({
  schedule: 'every 15 minutes',
  timeZone: 'UTC',
  secrets: [PRICE_UPDATER_PRIVATE_KEY],
  memory: '256MiB',
  timeoutSeconds: 60,
  region: 'us-central1',
}, async (event) => {
  logger.info('Starting automated price update check');

  try {
    // Fetch current ETH price
    const ethPrice = await fetchEthPrice();

    // Setup provider and contract
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(
      SALE_CONTRACT_ADDRESS,
      SALE_CONTRACT_ABI,
      provider
    );

    // Get current contract prices
    const [currentTokensPerEth, currentTokensPerUsdc] = await Promise.all([
      contract.tokensPerEth(),
      contract.tokensPerUsdc(),
    ]);

    // Calculate new price
    const newTokensPerEth = calculateTokensPerEth(ethPrice);

    logger.info('Price comparison', {
      ethPrice,
      currentTokensPerEth: ethers.formatEther(currentTokensPerEth),
      newTokensPerEth: ethers.formatEther(newTokensPerEth),
    });

    // Check if update is needed
    if (!shouldUpdatePrice(currentTokensPerEth, newTokensPerEth)) {
      logger.info('Price change below threshold, skipping update');

      await logPriceUpdate({
        timestamp: Date.now(),
        ethPrice,
        oldTokensPerEth: ethers.formatEther(currentTokensPerEth),
        newTokensPerEth: ethers.formatEther(newTokensPerEth),
        skipped: true,
        reason: `Price change below ${PRICE_CHANGE_THRESHOLD}% threshold`,
      });

      return;
    }

    // Create wallet from private key
    const privateKey = PRICE_UPDATER_PRIVATE_KEY.value();
    const wallet = new ethers.Wallet(privateKey, provider);
    const contractWithSigner = contract.connect(wallet);

    logger.info('Updating contract prices', {
      from: wallet.address,
      newTokensPerEth: ethers.formatEther(newTokensPerEth),
      tokensPerUsdc: ethers.formatEther(currentTokensPerUsdc),
    });

    // Execute update transaction
    const tx = await contractWithSigner.updatePrices(
      newTokensPerEth,
      currentTokensPerUsdc // Keep USDC price the same (it's stable)
    );

    logger.info('Transaction submitted', { txHash: tx.hash });

    // Wait for confirmation
    const receipt = await tx.wait();

    logger.info('Price update confirmed', {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    });

    // Log successful update
    await logPriceUpdate({
      timestamp: Date.now(),
      ethPrice,
      oldTokensPerEth: ethers.formatEther(currentTokensPerEth),
      newTokensPerEth: ethers.formatEther(newTokensPerEth),
      txHash: receipt.hash,
    });

    logger.info('Automated price update completed successfully');

  } catch (error: any) {
    logger.error('Automated price update failed', {
      error: error.message,
      stack: error.stack,
    });

    // Log failed update
    try {
      await logPriceUpdate({
        timestamp: Date.now(),
        ethPrice: 0,
        oldTokensPerEth: '0',
        newTokensPerEth: '0',
        error: error.message,
      });
    } catch (logError) {
      logger.error('Failed to log error', { logError });
    }

    throw error;
  }
});

/**
 * Manual trigger function for testing
 * Can be called via Firebase Functions HTTP endpoint
 */
export const manualPriceUpdate = onSchedule({
  schedule: 'every 24 hours', // Dummy schedule, call manually via HTTP
  secrets: [PRICE_UPDATER_PRIVATE_KEY],
  memory: '256MiB',
  timeoutSeconds: 60,
  region: 'us-central1',
}, async (event) => {
  logger.info('Manual price update triggered');
  // Reuse the same logic
  return updateTokenSalePrices(event);
});
