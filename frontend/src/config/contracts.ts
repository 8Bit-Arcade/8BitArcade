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
  EIGHT_BIT_TOKEN: '0x92f5523c2329eE281E7FEB8808FcE4b49ab1ebf8', // ← UPDATE: 8BIT token address
  GAME_REWARDS: '0x193A7E1a8e840b514AdeD9a1D69a94002d87D678',    // ← UPDATE: GameRewards address
  TOURNAMENT_MANAGER: '0xE01D484414e44f94F14A6B706c808A5f6941fdc6', // ← UPDATE: TournamentManager address
  TOKEN_SALE: '0x6d747A95b847607674e1470A59ab2640E7c5794C',      // ← UPDATE: TokenSale address
  TESTNET_FAUCET: '0x0000000000000000000000000000000000000000', // ← UPDATE: TestnetFaucet address
  USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',            // Arbitrum Sepolia USDC
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
  EIGHT_BIT_TOKEN: '0x92f5523c2329eE281E7FEB8808FcE4b49ab1ebf8', // ← UPDATE: 8BIT token address
  GAME_REWARDS: '0x193A7E1a8e840b514AdeD9a1D69a94002d87D678',    // ← UPDATE: GameRewards address
  TOURNAMENT_MANAGER: '0xE01D484414e44f94F14A6B706c808A5f6941fdc6', // ← UPDATE: TournamentManager address
  TOKEN_SALE: '0x6d747A95b847607674e1470A59ab2640E7c5794C',      // ← UPDATE: TokenSale address
  TESTNET_FAUCET: undefined, // Faucet not deployed on mainnet
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',            // Arbitrum One USDC
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
export const TOURNAMENT_MANAGER_ADDRESS = CONTRACTS.TOURNAMENT_MANAGER;
export const TOKEN_SALE_ADDRESS = CONTRACTS.TOKEN_SALE;
export const TESTNET_FAUCET_ADDRESS = CONTRACTS.TESTNET_FAUCET;
export const USDC_ADDRESS = CONTRACTS.USDC;
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

export const TOURNAMENT_MANAGER_ABI = [
  "function enterTournament(uint256 tournamentId) external",
  "function getTournament(uint256 tournamentId) view returns (uint8 tier, uint8 period, uint256 startTime, uint256 endTime, uint256 entryFee, uint256 prizePool, uint256 totalEntries, address winner, bool isActive)",
  "function hasPlayerEntered(uint256 tournamentId, address player) view returns (bool)",
  "function getPlayerScore(uint256 tournamentId, address player) view returns (uint256)",
  "function getParticipants(uint256 tournamentId) view returns (address[])",
  "function getActiveTournamentsCount() view returns (uint256)",
  "function STANDARD_WEEKLY_FEE() view returns (uint256)",
  "function STANDARD_MONTHLY_FEE() view returns (uint256)",
  "function HIGH_ROLLER_WEEKLY_FEE() view returns (uint256)",
  "function HIGH_ROLLER_MONTHLY_FEE() view returns (uint256)",
  "function STANDARD_WEEKLY_PRIZE() view returns (uint256)",
  "function STANDARD_MONTHLY_PRIZE() view returns (uint256)",
  "function HIGH_ROLLER_WEEKLY_PRIZE() view returns (uint256)",
  "function HIGH_ROLLER_MONTHLY_PRIZE() view returns (uint256)",
  "event TournamentCreated(uint256 indexed tournamentId, uint8 tier, uint8 period, uint256 startTime, uint256 endTime, uint256 entryFee, uint256 prizePool)",
  "event PlayerEntered(uint256 indexed tournamentId, address indexed player, uint256 entryFee)",
  "event WinnerDeclared(uint256 indexed tournamentId, address indexed winner, uint256 prizeAmount)",
  "event FeeBurned(uint256 indexed tournamentId, uint256 amount)",
];

export const TOKEN_SALE_ABI = [
  "function buyWithEth() external payable",
  "function buyWithUsdc(uint256 usdcAmount) external",
  "function TOKENS_FOR_SALE() view returns (uint256)",
  "function tokensSold() view returns (uint256)",
  "function ethRaised() view returns (uint256)",
  "function usdcRaised() view returns (uint256)",
  "function saleStartTime() view returns (uint256)",
  "function saleEndTime() view returns (uint256)",
  "function tokensPerEth() view returns (uint256)",
  "function tokensPerUsdc() view returns (uint256)",
  "function purchasedTokens(address buyer) view returns (uint256)",
  "function getSaleProgress() view returns (uint256)",
  "function getTimeRemaining() view returns (uint256)",
  "function isSaleActive() view returns (bool)",
  "function calculateTokensForEth(uint256 ethAmount) view returns (uint256)",
  "function calculateTokensForUsdc(uint256 usdcAmount) view returns (uint256)",
  "event TokensPurchased(address indexed buyer, uint256 amount, uint256 ethSpent, uint256 usdcSpent)",
];

export const USDC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

export const TESTNET_FAUCET_ABI = [
  "function claimTokens() external",
  "function canClaim(address user) view returns (bool)",
  "function getTimeUntilNextClaim(address user) view returns (uint256)",
  "function getUserInfo(address user) view returns (uint256 lastClaim, uint256 totalUserClaimed, bool canUserClaim, uint256 userBalance, uint256 timeUntilNext)",
  "function getFaucetStats() view returns (uint256 balance, uint256 distributed, uint256 claims, uint256 uniqueClaimers)",
  "function CLAIM_AMOUNT() view returns (uint256)",
  "function COOLDOWN_PERIOD() view returns (uint256)",
  "function MIN_BALANCE_THRESHOLD() view returns (uint256)",
  "event TokensClaimed(address indexed user, uint256 amount, uint256 timestamp)",
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
