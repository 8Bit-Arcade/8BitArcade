import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { arbitrum, arbitrumSepolia } from 'wagmi/chains';
import { http } from 'viem';
import { USE_TESTNET, CONTRACTS } from '@/config/contracts';

/**
 * Wagmi Configuration for 8-Bit Arcade
 *
 * Automatically uses testnet or mainnet based on USE_TESTNET flag
 * in config/contracts.ts
 *
 * ⚠️ IMPORTANT: Get your WalletConnect Project ID
 * 1. Visit: https://cloud.walletconnect.com
 * 2. Create a project
 * 3. Copy the Project ID
 * 4. Add to frontend/.env.local:
 *    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
 */

// Use testnet or mainnet based on config
const chains = USE_TESTNET
  ? [arbitrumSepolia] as const
  : [arbitrum] as const;

export const config = getDefaultConfig({
  appName: '8-Bit Arcade',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains,
  transports: {
  [chains[0].id]: http(
    USE_TESTNET 
      ? 'https://sepolia-rollup.arbitrum.io/rpc'  // ← Official Arbitrum RPC
      : 'https://arb-mainnet.g.alchemy.com/v2/demo'
  ),
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
