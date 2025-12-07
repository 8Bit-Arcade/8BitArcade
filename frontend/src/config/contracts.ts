/**
 * Smart Contract Configuration for 8-Bit Arcade
 *
 * ⚠️ IMPORTANT: UPDATE THESE ADDRESSES AFTER DEPLOYMENT ⚠️
 *
 * 1. Deploy contracts to Arbitrum Sepolia testnet first
 * 2. Update TESTNET addresses below with deployed addresses
 * 3. Test thoroughly on testnet
 * 4. Deploy to Arbitrum mainnet
 * 5. Update MAINNET addresses below
 * 6. Change USE_TESTNET to false when ready for production launch
 */

// ═══════════════════════════════════════════════════════════
// NETWORK CONFIGURATION
// ═══════════════════════════════════════════════════════════

/**
 * ⚠️ SWITCH THIS TO LAUNCH ON MAINNET ⚠️
 *
 * true = Use Arbitrum Sepolia Testnet (for development/testing)
 * false = Use Arbitrum One Mainnet (for production)
 *
 * When ready to launch publicly, set this to false
 */
export const USE_TESTNET = true;

// ═══════════════════════════════════════════════════════════
// TESTNET CONTRACT ADDRESSES (Arbitrum Sepolia)
// ═══════════════════════════════════════════════════════════

/**
 * ⚠️ UPDATE THESE AFTER DEPLOYING TO TESTNET ⚠️
 *
 * After running: npm run deploy:testnet
 * Copy the deployed addresses here
 */
const TESTNET_CONTRACTS = {
  EIGHT_BIT_TOKEN: '0x0000000000000000000000000000000000000000', // ← UPDATE: 8BIT token address
  GAME_REWARDS: '0x0000000000000000000000000000000000000000',    // ← UPDATE: GameRewards address
  CHAIN_ID: 421614, // Arbitrum Sepolia
  CHAIN_NAME: 'Arbitrum Sepolia',
  RPC_URL: 'https://sepolia-rollup.arbitrum.io/rpc',
  BLOCK_EXPLORER: 'https://sepolia.arbiscan.io',
};

// ═══════════════════════════════════════════════════════════
// MAINNET CONTRACT ADDRESSES (Arbitrum One)
// ═══════════════════════════════════════════════════════════

/**
 * ⚠️ UPDATE THESE AFTER DEPLOYING TO MAINNET ⚠️
 *
 * After running: npm run deploy:mainnet
 * Copy the deployed addresses here
 */
const MAINNET_CONTRACTS = {
  EIGHT_BIT_TOKEN: '0x0000000000000000000000000000000000000000', // ← UPDATE: 8BIT token address
  GAME_REWARDS: '0x0000000000000000000000000000000000000000',    // ← UPDATE: GameRewards address
  CHAIN_ID: 42161, // Arbitrum One
  CHAIN_NAME: 'Arbitrum One',
  RPC_URL: 'https://arb1.arbitrum.io/rpc',
  BLOCK_EXPLORER: 'https://arbiscan.io',
};

// ═══════════════════════════════════════════════════════════
// ACTIVE CONFIGURATION (Auto-selected based on USE_TESTNET)
// ═══════════════════════════════════════════════════════════

export const CONTRACTS = USE_TESTNET ? TESTNET_CONTRACTS : MAINNET_CONTRACTS;

// Export individual addresses for convenience
export const EIGHT_BIT_TOKEN_ADDRESS = CONTRACTS.EIGHT_BIT_TOKEN;
export const GAME_REWARDS_ADDRESS = CONTRACTS.GAME_REWARDS;
export const ARBITRUM_CHAIN_ID = CONTRACTS.CHAIN_ID;
export const ARBITRUM_CHAIN_NAME = CONTRACTS.CHAIN_NAME;
export const ARBITRUM_RPC_URL = CONTRACTS.RPC_URL;
export const BLOCK_EXPLORER_URL = CONTRACTS.BLOCK_EXPLORER;

// ═══════════════════════════════════════════════════════════
// REWARD DISTRIBUTION WALLET
// ═══════════════════════════════════════════════════════════

/**
 * ⚠️ CREATE A NEW SECURE WALLET FOR THIS ⚠️
 *
 * This wallet will be set as the rewardsDistributor in the GameRewards contract.
 * It's the backend wallet that calls distributeRewards() daily.
 *
 * SECURITY TIPS:
 * - Create a new wallet specifically for this purpose
 * - Store private key securely (use environment variables)
 * - Only fund it with enough ETH for gas (not your main wallet)
 * - Keep the private key in backend .env file only
 *
 * After deployment, you must call:
 * gameRewards.setRewardsDistributor(REWARDS_DISTRIBUTOR_ADDRESS)
 */
export const REWARDS_DISTRIBUTOR_ADDRESS = '0x0000000000000000000000000000000000000000'; // ← UPDATE: Backend wallet address

// ═══════════════════════════════════════════════════════════
// ABI (Application Binary Interface)
// ═══════════════════════════════════════════════════════════

/**
 * Minimal ABIs for interacting with contracts from frontend
 * These will be auto-generated after compiling contracts
 *
 * After running: npm run compile
 * Copy the ABIs from: contracts/artifacts/contracts/
 */

export const EIGHT_BIT_TOKEN_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
];

export const GAME_REWARDS_ABI = [
  "function dailyRewardPool() view returns (uint256)",
  "function getRewardForRank(uint256 rank) view returns (uint256)",
  "function totalRewardsEarned(address player) view returns (uint256)",
  "function getPlayerRewards(address player) view returns (uint256)",
  "function isDistributed(uint256 dayId) view returns (bool)",
  "event RewardDistributed(uint256 indexed dayId, address indexed player, uint256 rank, uint256 amount)",
];

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Check if user is on the correct network
 */
export function isCorrectNetwork(chainId: number): boolean {
  return chainId === ARBITRUM_CHAIN_ID;
}

/**
 * Get network display name
 */
export function getNetworkName(): string {
  return ARBITRUM_CHAIN_NAME;
}

/**
 * Get block explorer URL for an address
 */
export function getExplorerUrl(address: string): string {
  return `${BLOCK_EXPLORER_URL}/address/${address}`;
}

/**
 * Get block explorer URL for a transaction
 */
export function getTxExplorerUrl(txHash: string): string {
  return `${BLOCK_EXPLORER_URL}/tx/${txHash}`;
}
