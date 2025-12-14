/**
 * Contract Configuration
 *
 * UPDATE THESE ADDRESSES AFTER DEPLOYMENT
 */

// Network configuration
export const USE_TESTNET = true; // Set to false for mainnet

// Contract addresses - UPDATE AFTER DEPLOYMENT
export const GAME_REWARDS_ADDRESS = USE_TESTNET
  ? '0x0000000000000000000000000000000000000000' // UPDATE: Deploy GameRewards to testnet
  : '0x0000000000000000000000000000000000000000'; // UPDATE: Deploy GameRewards to mainnet

export const EIGHT_BIT_TOKEN_ADDRESS = USE_TESTNET
  ? '0x0000000000000000000000000000000000000000' // UPDATE: Deploy 8BIT token to testnet
  : '0x0000000000000000000000000000000000000000'; // UPDATE: Deploy 8BIT token to mainnet

// RPC URLs
export const ARBITRUM_RPC_URL = USE_TESTNET
  ? 'https://sepolia-rollup.arbitrum.io/rpc' // Arbitrum Sepolia testnet
  : 'https://arb1.arbitrum.io/rpc'; // Arbitrum One mainnet

// Network details
export const CHAIN_ID = USE_TESTNET ? 421614 : 42161; // Sepolia : Mainnet
export const CHAIN_NAME = USE_TESTNET ? 'Arbitrum Sepolia' : 'Arbitrum One';

/**
 * SETUP INSTRUCTIONS:
 *
 * 1. Deploy smart contracts to testnet/mainnet
 * 2. Update the contract addresses above
 * 3. Set USE_TESTNET to false when ready for mainnet
 * 4. Deploy functions: `firebase deploy --only functions`
 */
