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
  EIGHT_BIT_TOKEN: '0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d',
  GAME_REWARDS: '0x528c9130A05bEf9a9632FbB3D8735287A2e44a4E',
  TOURNAMENT_MANAGER: '0xe06C92f15F426b0f6Fccb66302790E533C5Dfbb7',
  TOURNAMENT_PAYMENTS: '0x0606eDf5Fb1912160b700846C48a49800ae6A1ec', // Fixed TickMath implementation
  TOURNAMENT_BUYBACK: '0x6F3eAF6FB7218340aF69f81e143A01507566a6A6', // Fixed TickMath implementation
  TOKEN_SALE: '0x057B1130dD6E8FcBc144bb34172e45293C6839fE',
  TREASURY_GAS_MANAGER: '0x39F49a46CAB85CF079Cde25EAE311A563d3952EC',
  TESTNET_FAUCET: '0x25A4109083f882FCFbC9Ea7cE5Cd942dbae38952',
  VESTED_AIRDROP: '0xC9aaa944B163eB4A580151DE852836330ECB50b1', // VestedAirdrop deployed on Arbitrum Sepolia
  TIERED_STAKING: '0xC193451f59De0df09EC8359D091F8890A80F20c4', // Deployed with 9.9M 8BIT initial funding
  ACHIEVEMENT_BADGES: '0x8dE45E3e37f0721D64d63E32da5f37CfaCF9ca9f', // Redeployed UUPS proxy (fixed tokenURI)
  TRADEABLE_ITEMS: '0x3F09919fba62EAec1295F577D92fbF2555247c44',   // Deployed UUPS proxy
  ACHIEVEMENT_MANAGER: '0xE68d3AdD44C541fF76C85D185d02BE5ceAC833B3', // Redeployed UUPS proxy (proper ERC-1967)
  USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum Sepolia USDC
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
  TOURNAMENT_MANAGER: '0x0000000000000000000000000000000000000000', // ← UPDATE: TournamentManager address
  TOURNAMENT_PAYMENTS: '0x0000000000000000000000000000000000000000', // ← UPDATE: TournamentPayments address
  TOURNAMENT_BUYBACK: '0x0000000000000000000000000000000000000000', // ← UPDATE: TournamentBuyback address
  TOKEN_SALE: '0x0000000000000000000000000000000000000000',      // ← UPDATE: TokenSale address
  TREASURY_GAS_MANAGER: '0x0000000000000000000000000000000000000000', // ← UPDATE: TreasuryGasManager address
  TESTNET_FAUCET: undefined, // Faucet not deployed on mainnet
  VESTED_AIRDROP: '0x0000000000000000000000000000000000000000', // ← UPDATE: VestedAirdrop address
  ACHIEVEMENT_BADGES: '0x0000000000000000000000000000000000000000', // ← UPDATE: AchievementBadges address
  TRADEABLE_ITEMS: '0x0000000000000000000000000000000000000000',   // ← UPDATE: TradeableItems address
  ACHIEVEMENT_MANAGER: '0x0000000000000000000000000000000000000000', // ← UPDATE: AchievementManager address
  USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum One USDC
  CHAIN_ID: 42161, // Arbitrum One
  CHAIN_NAME: 'Arbitrum One',
  RPC_URL: 'https://arb1.arbitrum.io/rpc',
  BLOCK_EXPLORER: 'https://arbiscan.io',
};

// ═══════════════════════════════════════════════════════════
// ACTIVE CONFIGURATION (Auto-selected based on USE_TESTNET)
// ═══════════════════════════════════════════════════════════

// Export network-specific configs for direct access
export { TESTNET_CONTRACTS, MAINNET_CONTRACTS };

export const CONTRACTS = USE_TESTNET ? TESTNET_CONTRACTS : MAINNET_CONTRACTS;

// Export individual addresses for convenience
export const EIGHT_BIT_TOKEN_ADDRESS = CONTRACTS.EIGHT_BIT_TOKEN;
export const GAME_REWARDS_ADDRESS = CONTRACTS.GAME_REWARDS;
export const TOURNAMENT_MANAGER_ADDRESS = CONTRACTS.TOURNAMENT_MANAGER;
export const TOURNAMENT_PAYMENTS_ADDRESS = CONTRACTS.TOURNAMENT_PAYMENTS;
export const TOURNAMENT_BUYBACK_ADDRESS = CONTRACTS.TOURNAMENT_BUYBACK;
export const TOKEN_SALE_ADDRESS = CONTRACTS.TOKEN_SALE;
export const TREASURY_GAS_MANAGER_ADDRESS = CONTRACTS.TREASURY_GAS_MANAGER;
export const TESTNET_FAUCET_ADDRESS = CONTRACTS.TESTNET_FAUCET;
export const VESTED_AIRDROP_ADDRESS = CONTRACTS.VESTED_AIRDROP;
export const ACHIEVEMENT_BADGES_ADDRESS = CONTRACTS.ACHIEVEMENT_BADGES;
export const TRADEABLE_ITEMS_ADDRESS = CONTRACTS.TRADEABLE_ITEMS;
export const ACHIEVEMENT_MANAGER_ADDRESS = CONTRACTS.ACHIEVEMENT_MANAGER;
export const USDC_ADDRESS = CONTRACTS.USDC;
export const ARBITRUM_CHAIN_ID = CONTRACTS.CHAIN_ID;
export const ARBITRUM_CHAIN_NAME = CONTRACTS.CHAIN_NAME;
export const ARBITRUM_RPC_URL = CONTRACTS.RPC_URL;
export const BLOCK_EXPLORER_URL = CONTRACTS.BLOCK_EXPLORER;

// ═══════════════════════════════════════════════════════════
// REWARD DISTRIBUTION WALLET
// ═══════════════════════════════════════════════════════════

/**
 * Backend wallet that distributes daily rewards and manages automated operations
 *
 * This wallet is set as the rewardsDistributor in the GameRewards contract.
 * It calls distributeRewards() daily via Firebase Functions.
 *
 * SECURITY:
 * - Private key stored securely in Firebase Functions config
 * - Only funded with enough ETH for gas operations
 * - Separate from deployer/founder wallet
 * - Has MINTER_ROLE to distribute daily rewards
 */
export const REWARDS_DISTRIBUTOR_ADDRESS = '0x3879aA591532B8a7BCe322Edff8fD09F7FB5dC9B';

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
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'from', type: 'address' },
      { indexed: true, internalType: 'address', name: 'to', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'value', type: 'uint256' },
    ],
    name: 'Transfer',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'owner', type: 'address' },
      { indexed: true, internalType: 'address', name: 'spender', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'value', type: 'uint256' },
    ],
    name: 'Approval',
    type: 'event',
  },
] as const;

export const GAME_REWARDS_ABI = [
  "function dailyRewardPool() view returns (uint256)",
  "function getRewardForRank(uint256 rank) view returns (uint256)",
  "function totalRewardsEarned(address player) view returns (uint256)",
  "function getPlayerRewards(address player) view returns (uint256)",
  "function isDistributed(uint256 dayId) view returns (bool)",
  "event RewardDistributed(uint256 indexed dayId, address indexed player, uint256 rank, uint256 amount)",
] as const;

export const TOURNAMENT_MANAGER_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'tournamentId', type: 'uint256' }],
    name: 'enterTournament',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tournamentId', type: 'uint256' }],
    name: 'getTournament',
    outputs: [
      { internalType: 'uint8', name: 'tier', type: 'uint8' },
      { internalType: 'uint8', name: 'period', type: 'uint8' },
      { internalType: 'uint256', name: 'startTime', type: 'uint256' },
      { internalType: 'uint256', name: 'endTime', type: 'uint256' },
      { internalType: 'uint256', name: 'entryFee', type: 'uint256' },
      { internalType: 'uint256', name: 'prizePool', type: 'uint256' },
      { internalType: 'uint256', name: 'totalEntries', type: 'uint256' },
      { internalType: 'address', name: 'winner', type: 'address' },
      { internalType: 'bool', name: 'isActive', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'tournamentId', type: 'uint256' },
      { internalType: 'address', name: 'player', type: 'address' },
    ],
    name: 'hasPlayerEntered',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'tournamentId', type: 'uint256' },
      { internalType: 'address', name: 'player', type: 'address' },
    ],
    name: 'getPlayerScore',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tournamentId', type: 'uint256' }],
    name: 'getParticipants',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getActiveTournamentsCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextTournamentId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'STANDARD_WEEKLY_FEE',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'STANDARD_MONTHLY_FEE',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'HIGH_ROLLER_WEEKLY_FEE',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'HIGH_ROLLER_MONTHLY_FEE',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'tournamentId', type: 'uint256' },
      { indexed: false, internalType: 'uint8', name: 'tier', type: 'uint8' },
      { indexed: false, internalType: 'uint8', name: 'period', type: 'uint8' },
      { indexed: false, internalType: 'uint256', name: 'startTime', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'endTime', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'entryFee', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'prizePool', type: 'uint256' },
    ],
    name: 'TournamentCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'tournamentId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'player', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'entryFee', type: 'uint256' },
    ],
    name: 'PlayerEntered',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'tournamentId', type: 'uint256' },
      { indexed: true, internalType: 'address', name: 'winner', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'prizeAmount', type: 'uint256' },
    ],
    name: 'WinnerDeclared',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'tournamentId', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'FeeBurned',
    type: 'event',
  },
] as const;

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
] as const;

export const USDC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
] as const;

export const VESTED_AIRDROP_ABI = [
  {
    inputs: [
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'bytes32[]', name: 'proof', type: 'bytes32[]' },
    ],
    name: 'initiateClaim',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'claimVested',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'calculateVested',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getClaimable',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getVestingInfo',
    outputs: [
      { internalType: 'uint256', name: '', type: 'uint256' },
      { internalType: 'uint256', name: '', type: 'uint256' },
      { internalType: 'uint256', name: '', type: 'uint256' },
      { internalType: 'uint256', name: '', type: 'uint256' },
      { internalType: 'uint256', name: '', type: 'uint256' },
      { internalType: 'uint256', name: '', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'user', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'bytes32[]', name: 'proof', type: 'bytes32[]' },
    ],
    name: 'canClaim',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getStats',
    outputs: [
      { internalType: 'uint256', name: '', type: 'uint256' },
      { internalType: 'uint256', name: '', type: 'uint256' },
      { internalType: 'uint256', name: '', type: 'uint256' },
      { internalType: 'bool', name: '', type: 'bool' },
      { internalType: 'uint256', name: '', type: 'uint256' },
      { internalType: 'uint256', name: '', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'vesting',
    outputs: [
      { internalType: 'uint256', name: 'totalAmount', type: 'uint256' },
      { internalType: 'uint256', name: 'claimed', type: 'uint256' },
      { internalType: 'uint256', name: 'vestingStart', type: 'uint256' },
      { internalType: 'bool', name: 'initiated', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'merkleRoot',
    outputs: [{ internalType: 'bytes32', name: '', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'claimDeadline',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'isActive',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalAllocated',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalClaimed',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'totalAmount', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'initialRelease', type: 'uint256' },
    ],
    name: 'ClaimInitiated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'VestedClaimed',
    type: 'event',
  },
] as const;

export const TESTNET_FAUCET_ABI = [
  {
    inputs: [],
    name: 'claimTokens',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'canClaim',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getTimeUntilNextClaim',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'user', type: 'address' }],
    name: 'getUserInfo',
    outputs: [
      { internalType: 'uint256', name: 'lastClaim', type: 'uint256' },
      { internalType: 'uint256', name: 'totalUserClaimed', type: 'uint256' },
      { internalType: 'bool', name: 'canUserClaim', type: 'bool' },
      { internalType: 'uint256', name: 'userBalance', type: 'uint256' },
      { internalType: 'uint256', name: 'timeUntilNext', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getFaucetStats',
    outputs: [
      { internalType: 'uint256', name: 'balance', type: 'uint256' },
      { internalType: 'uint256', name: 'distributed', type: 'uint256' },
      { internalType: 'uint256', name: 'claims', type: 'uint256' },
      { internalType: 'uint256', name: 'uniqueClaimers', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'CLAIM_AMOUNT',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'COOLDOWN_PERIOD',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'MIN_BALANCE_THRESHOLD',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'lastClaimTime',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'totalClaimed',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'isPaused',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'user', type: 'address' },
      { indexed: false, internalType: 'uint256', name: 'amount', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'timestamp', type: 'uint256' },
    ],
    name: 'TokensClaimed',
    type: 'event',
  },
] as const;


// ═══════════════════════════════════════════════════════════
// NFT REWARDS ABIS
// ═══════════════════════════════════════════════════════════

export const ACHIEVEMENT_BADGES_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'player', type: 'address' }, { internalType: 'uint256', name: 'achievementTypeId', type: 'uint256' }],
    name: 'hasAchievement',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'player', type: 'address' }, { internalType: 'uint256', name: 'achievementTypeId', type: 'uint256' }],
    name: 'getAchievementToken',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'achievementTypeId', type: 'uint256' }],
    name: 'getAchievementCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextTokenId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'tokenAchievementType',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'locked',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'player', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { indexed: true, internalType: 'uint256', name: 'achievementTypeId', type: 'uint256' },
    ],
    name: 'BadgeMinted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [{ indexed: false, internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'Locked',
    type: 'event',
  },
] as const;

export const TRADEABLE_ITEMS_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'itemTypeId', type: 'uint256' }],
    name: 'mint',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'itemTypeId', type: 'uint256' }],
    name: 'getItemType',
    outputs: [
      { internalType: 'uint256', name: 'maxSupply', type: 'uint256' },
      { internalType: 'uint256', name: 'totalMinted', type: 'uint256' },
      { internalType: 'uint256', name: 'requiredAchievement', type: 'uint256' },
      { internalType: 'uint256', name: 'priceInWei', type: 'uint256' },
      { internalType: 'bool', name: 'active', type: 'bool' },
      { internalType: 'string', name: 'uri', type: 'string' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'player', type: 'address' }, { internalType: 'uint256', name: 'itemTypeId', type: 'uint256' }],
    name: 'canMint',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'tokenURI',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'ownerOf',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'owner', type: 'address' }, { internalType: 'uint256', name: 'index', type: 'uint256' }],
    name: 'tokenOfOwnerByIndex',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextTokenId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextItemTypeId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
    name: 'tokenItemType',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { internalType: 'uint256', name: 'salePrice', type: 'uint256' },
    ],
    name: 'royaltyInfo',
    outputs: [
      { internalType: 'address', name: 'receiver', type: 'address' },
      { internalType: 'uint256', name: 'royaltyAmount', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'to', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'tokenId', type: 'uint256' },
      { indexed: true, internalType: 'uint256', name: 'itemTypeId', type: 'uint256' },
    ],
    name: 'ItemMinted',
    type: 'event',
  },
] as const;

export const ACHIEVEMENT_MANAGER_ABI = [
  {
    inputs: [{ internalType: 'uint256', name: 'goalId', type: 'uint256' }],
    name: 'getGoal',
    outputs: [
      { internalType: 'string', name: 'name', type: 'string' },
      { internalType: 'string', name: 'description', type: 'string' },
      { internalType: 'uint8', name: 'category', type: 'uint8' },
      { internalType: 'uint256', name: 'threshold', type: 'uint256' },
      { internalType: 'string', name: 'gameId', type: 'string' },
      { internalType: 'uint256', name: 'achievementTypeId', type: 'uint256' },
      { internalType: 'uint256', name: 'rewardItemTypeId', type: 'uint256' },
      { internalType: 'uint256', name: 'rewardTokenAmount', type: 'uint256' },
      { internalType: 'bool', name: 'active', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'player', type: 'address' }, { internalType: 'uint256', name: 'goalId', type: 'uint256' }],
    name: 'hasCompletedGoal',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'player', type: 'address' }],
    name: 'getPlayerAchievementCount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'player', type: 'address' },
      { internalType: 'uint256[]', name: 'goalIds', type: 'uint256[]' },
    ],
    name: 'getPlayerGoalStatuses',
    outputs: [{ internalType: 'bool[]', name: 'completed', type: 'bool[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'nextGoalId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalAchievementsAwarded',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'address', name: 'player', type: 'address' },
      { indexed: true, internalType: 'uint256', name: 'goalId', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'badgeTokenId', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'rewardItemTokenId', type: 'uint256' },
      { indexed: false, internalType: 'uint256', name: 'rewardTokenAmount', type: 'uint256' },
    ],
    name: 'AchievementAwarded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: 'uint256', name: 'goalId', type: 'uint256' },
      { indexed: false, internalType: 'string', name: 'name', type: 'string' },
      { indexed: false, internalType: 'uint8', name: 'category', type: 'uint8' },
      { indexed: false, internalType: 'uint256', name: 'threshold', type: 'uint256' },
    ],
    name: 'GoalCreated',
    type: 'event',
  },
] as const;

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
