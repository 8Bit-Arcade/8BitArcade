import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { arbitrum, arbitrumSepolia } from 'wagmi/chains';
import { http } from 'viem';
import { USE_TESTNET, CONTRACTS } from '@/config/contracts';

/**
 * Wagmi Configuration for 8-Bit Arcade
 *
 * Supports BOTH Arbitrum Sepolia (testnet) and Arbitrum One (mainnet) so
 * contract reads work regardless of which chain the user's wallet is on.
 * Some features (token sale, staking) are on mainnet while others (NFT
 * achievements) are still on testnet.
 *
 * ⚠️ IMPORTANT: Get your WalletConnect Project ID
 * 1. Visit: https://cloud.walletconnect.com
 * 2. Create a project
 * 3. Copy the Project ID
 * 4. Add to frontend/.env.local:
 *    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
 */

// Support both chains — the default chain is first in the array
const chains = USE_TESTNET
  ? [arbitrumSepolia, arbitrum] as const
  : [arbitrum, arbitrumSepolia] as const;

export const config = getDefaultConfig({
  appName: '8-Bit Arcade',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'd1553a66d89d56748c2ec4efae456f8e',
  chains,
  transports: {
    [arbitrumSepolia.id]: http('https://sepolia-rollup.arbitrum.io/rpc'),
    [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
  },
  ssr: true,
});

// Export contract addresses for easy access
export { CONTRACTS, USE_TESTNET } from '@/config/contracts';
export { EIGHT_BIT_TOKEN_ADDRESS, GAME_REWARDS_ADDRESS } from '@/config/contracts';

// Chain IDs
export const SUPPORTED_CHAIN_IDS = {
  ARBITRUM: 42161,
  ARBITRUM_SEPOLIA: 421614,
} as const;

// Get current chain ID
export const getCurrentChainId = (): number => {
  return USE_TESTNET
    ? SUPPORTED_CHAIN_IDS.ARBITRUM_SEPOLIA
    : SUPPORTED_CHAIN_IDS.ARBITRUM;
};
