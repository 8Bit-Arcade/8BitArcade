import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { arbitrum, arbitrumSepolia } from 'wagmi/chains';

// Contract addresses - will be updated after deployment
export const CONTRACT_ADDRESSES = {
  token: process.env.NEXT_PUBLIC_TOKEN_ADDRESS || '',
  rewardsPool: process.env.NEXT_PUBLIC_REWARDS_POOL_ADDRESS || '',
  tournamentManager: process.env.NEXT_PUBLIC_TOURNAMENT_MANAGER_ADDRESS || '',
  scoreOracle: process.env.NEXT_PUBLIC_SCORE_ORACLE_ADDRESS || '',
} as const;

// Use testnet for development, mainnet for production
const chains = process.env.NEXT_PUBLIC_USE_TESTNET === 'true'
  ? [arbitrumSepolia] as const
  : [arbitrum] as const;

export const config = getDefaultConfig({
  appName: '8-Bit Arcade',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'YOUR_PROJECT_ID',
  chains,
  ssr: true,
});

// Chain IDs
export const SUPPORTED_CHAIN_IDS = {
  ARBITRUM: 42161,
  ARBITRUM_SEPOLIA: 421614,
} as const;

// Get current chain ID
export const getCurrentChainId = (): number => {
  return process.env.NEXT_PUBLIC_USE_TESTNET === 'true'
    ? SUPPORTED_CHAIN_IDS.ARBITRUM_SEPOLIA
    : SUPPORTED_CHAIN_IDS.ARBITRUM;
};
