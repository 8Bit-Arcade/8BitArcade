import { ethers, upgrades } from "hardhat";

/**
 * Mainnet Deployment + Migration Script for NFT Achievement System
 *
 * This script:
 * 1. Queries testnet AchievementManager for all earned achievements
 * 2. Deploys AchievementBadges, TradeableItems, AchievementManager to Arbitrum One
 * 3. Links contracts, creates 20 goals, sets metadata URI
 * 4. Authorizes AchievementManager as minter on EightBitToken (deployer must be token owner)
 * 5. Batch-awards all testnet achievements on mainnet (NFT badges + 8BIT token rewards)
 *
 * PREREQUISITES:
 * - Deployer wallet must be 0x80361876199e2318d6993A07e37177cFd21B64a7 (EightBitToken owner)
 * - Set PRIVATE_KEY in contracts/.env to the deployer wallet's private key
 * - Deployer must have ETH on Arbitrum One for gas (~$2-5 worth)
 *
 * DEPLOYMENT:
 *   cd contracts
 *   npx hardhat run scripts/deploy-nft-mainnet.ts --network arbitrumOne
 */

// ═══════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════

// Mainnet EightBitToken
const EIGHT_BIT_TOKEN_ADDRESS = "0x37ee26669659758109c94862e49B492247Be26df";

// Backend verifier wallet (Firebase Functions)
const BACKEND_VERIFIER = "0x3879aA591532B8a7BCe322Edff8fD09F7FB5dC9B";

// Metadata base URI on Pinata (chain-agnostic — same IPFS content)
const BADGE_METADATA_BASE_URI = "https://orange-encouraging-perch-476.mypinata.cloud/ipfs/bafybeicq7qgtsrr4yl45a7waqv7wiluy6nuetjnjeddfo2pxwzljsyin7m/metadata/badges/";
const ITEM_CONTRACT_URI = "https://orange-encouraging-perch-476.mypinata.cloud/ipfs/bafybeicq7qgtsrr4yl45a7waqv7wiluy6nuetjnjeddfo2pxwzljsyin7m/metadata/collection.json";

// Testnet contract address (for querying migration data)
const TESTNET_MANAGER_ADDRESS = "0xE68d3AdD44C541fF76C85D185d02BE5ceAC833B3";
const TESTNET_RPC = "https://sepolia-rollup.arbitrum.io/rpc";

// ═══════════════════════════════════════════════════════════
// GOAL CONFIGS (identical to testnet — same 20 goals)
// ═══════════════════════════════════════════════════════════

function getGoalConfigs() {
  return [
    // ── SCORE (4) ──
    { name: "Space Rocks Master", desc: "Score 25,000 in Space Rocks", category: 0, threshold: 25000, gameId: "space-rocks", achievementType: 1, rewardItem: 0, rewardTokens: ethers.parseEther("500") },
    { name: "Galaxy Ace", desc: "Score 50,000 in Galaxy Fighter", category: 0, threshold: 50000, gameId: "galaxy-fighter", achievementType: 2, rewardItem: 0, rewardTokens: ethers.parseEther("200") },
    { name: "Tetris God", desc: "Score 5,000 in Block Drop", category: 0, threshold: 5000, gameId: "block-drop", achievementType: 3, rewardItem: 0, rewardTokens: ethers.parseEther("300") },
    { name: "Shutout King", desc: "Win 11-0 three times in Paddle Battle", category: 0, threshold: 3, gameId: "paddle-battle", achievementType: 4, rewardItem: 0, rewardTokens: ethers.parseEther("400") },

    // ── GAMES PLAYED (2) ──
    { name: "First Steps", desc: "Play 10 games", category: 1, threshold: 10, gameId: "", achievementType: 5, rewardItem: 0, rewardTokens: ethers.parseEther("50") },
    { name: "8-Bit Legend", desc: "Play 1,000 games", category: 1, threshold: 1000, gameId: "", achievementType: 6, rewardItem: 0, rewardTokens: ethers.parseEther("2500") },

    // ── WINS (1) ──
    { name: "Tournament Champion", desc: "Win 10 tournaments", category: 2, threshold: 10, gameId: "", achievementType: 7, rewardItem: 0, rewardTokens: ethers.parseEther("1000") },

    // ── STREAK (2) ──
    { name: "Week Warrior", desc: "Play 7 days in a row", category: 3, threshold: 7, gameId: "", achievementType: 8, rewardItem: 0, rewardTokens: ethers.parseEther("150") },
    { name: "Century Club", desc: "Play 100 days in a row", category: 3, threshold: 100, gameId: "", achievementType: 9, rewardItem: 0, rewardTokens: ethers.parseEther("5000") },

    // ── COLLECTION / TIER BADGES (3) ──
    { name: "8Bit Gamer", desc: "Earn 10 achievement badges - Gamer tier unlocked", category: 4, threshold: 10, gameId: "", achievementType: 10, rewardItem: 0, rewardTokens: ethers.parseEther("500") },
    { name: "8Bit Prodigy", desc: "Earn 15 achievement badges - Prodigy tier unlocked", category: 4, threshold: 15, gameId: "", achievementType: 11, rewardItem: 0, rewardTokens: ethers.parseEther("2000") },
    { name: "8Bit God", desc: "Earn 18 achievement badges - the ultimate tier", category: 4, threshold: 18, gameId: "", achievementType: 12, rewardItem: 0, rewardTokens: ethers.parseEther("25000") },

    // ── SPECIAL (3) ──
    { name: "Early Adopter", desc: "Be among the first 100 players", category: 6, threshold: 100, gameId: "", achievementType: 13, rewardItem: 0, rewardTokens: ethers.parseEther("500") },
    { name: "Game Explorer", desc: "Play all 12 games at least once", category: 6, threshold: 12, gameId: "", achievementType: 14, rewardItem: 0, rewardTokens: ethers.parseEther("300") },
    { name: "OG Member", desc: "Verified OG community member", category: 6, threshold: 1, gameId: "", achievementType: 15, rewardItem: 0, rewardTokens: ethers.parseEther("1000") },

    // ── HIDDEN (5) ──
    { name: "Lucky 777", desc: "???", category: 6, threshold: 1, gameId: "", achievementType: 16, rewardItem: 0, rewardTokens: ethers.parseEther("777") },
    { name: "Night Owl", desc: "???", category: 6, threshold: 1, gameId: "", achievementType: 17, rewardItem: 0, rewardTokens: ethers.parseEther("500") },
    { name: "Palindrome Master", desc: "???", category: 6, threshold: 1, gameId: "", achievementType: 18, rewardItem: 0, rewardTokens: ethers.parseEther("1000") },
    { name: "Double Trouble", desc: "???", category: 6, threshold: 1, gameId: "", achievementType: 19, rewardItem: 0, rewardTokens: ethers.parseEther("750") },
    { name: "The Answer", desc: "???", category: 6, threshold: 1, gameId: "", achievementType: 20, rewardItem: 0, rewardTokens: ethers.parseEther("420") },
  ];
}

// ═══════════════════════════════════════════════════════════
// PHASE 1: QUERY TESTNET ACHIEVEMENTS
// ═══════════════════════════════════════════════════════════

async function queryTestnetAchievements(): Promise<Record<number, string[]>> {
  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║  PHASE 1: QUERYING TESTNET ACHIEVEMENT DATA      ║");
  console.log("╚═══════════════════════════════════════════════════╝");
  console.log();

  const testnetProvider = new ethers.JsonRpcProvider(TESTNET_RPC);

  const eventSig = ethers.id("AchievementAwarded(address,uint256,uint256,uint256,uint256)");
  const iface = new ethers.Interface([
    "event AchievementAwarded(address indexed player, uint256 indexed goalId, uint256 badgeTokenId, uint256 rewardItemTokenId, uint256 rewardTokenAmount)"
  ]);

  console.log("Fetching AchievementAwarded events from testnet...");
  console.log("Contract:", TESTNET_MANAGER_ADDRESS);

  const logs = await testnetProvider.getLogs({
    address: TESTNET_MANAGER_ADDRESS,
    topics: [eventSig],
    fromBlock: 0,
    toBlock: "latest",
  });

  console.log(`Found ${logs.length} achievement events`);
  console.log();

  // Group by goalId, deduplicate wallets
  const goalWallets: Record<number, string[]> = {};
  for (const log of logs) {
    const parsed = iface.parseLog({ topics: log.topics, data: log.data });
    if (!parsed) continue;
    const player = parsed.args.player;
    const goalId = Number(parsed.args.goalId);

    if (!goalWallets[goalId]) goalWallets[goalId] = [];
    if (!goalWallets[goalId].includes(player)) {
      goalWallets[goalId].push(player);
    }
  }

  // Print summary
  let totalAchievements = 0;
  const allWallets = new Set<string>();

  const goalConfigs = getGoalConfigs();
  for (const [goalIdStr, wallets] of Object.entries(goalWallets).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    const goalId = Number(goalIdStr);
    const goalConfig = goalConfigs.find(g => g.achievementType === goalId);
    const goalName = goalConfig ? goalConfig.name : `Unknown Goal`;
    console.log(`  Goal ${goalId} (${goalName}): ${wallets.length} wallets`);
    totalAchievements += wallets.length;
    wallets.forEach(w => allWallets.add(w));
  }

  console.log();
  console.log(`Total: ${totalAchievements} achievements across ${allWallets.size} unique wallets`);
  console.log();

  return goalWallets;
}

// ═══════════════════════════════════════════════════════════
// PHASE 2: DEPLOY CONTRACTS
// ═══════════════════════════════════════════════════════════

async function deployContracts(deployer: any) {
  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║  PHASE 2: DEPLOYING CONTRACTS TO MAINNET         ║");
  console.log("╚═══════════════════════════════════════════════════╝");
  console.log();

  // 2a. Deploy AchievementBadges (Soulbound, UUPS Proxy)
  console.log("Deploying AchievementBadges (Soulbound NFTs, UUPS Proxy)...");
  const AchievementBadges = await ethers.getContractFactory("AchievementBadges");
  const badges = await upgrades.deployProxy(
    AchievementBadges,
    [BADGE_METADATA_BASE_URI],
    { kind: "uups" }
  );
  await badges.waitForDeployment();
  const badgesAddress = await badges.getAddress();
  console.log("  AchievementBadges proxy:", badgesAddress);
  console.log();

  // 2b. Deploy TradeableItems (UUPS Proxy)
  console.log("Deploying TradeableItems (Tradeable NFTs, UUPS Proxy)...");
  const TradeableItems = await ethers.getContractFactory("TradeableItems");
  const items = await upgrades.deployProxy(
    TradeableItems,
    [badgesAddress, EIGHT_BIT_TOKEN_ADDRESS, deployer.address, ITEM_CONTRACT_URI],
    { kind: "uups" }
  );
  await items.waitForDeployment();
  const itemsAddress = await items.getAddress();
  console.log("  TradeableItems proxy:", itemsAddress);
  console.log();

  // 2c. Deploy AchievementManager (UUPS Proxy)
  console.log("Deploying AchievementManager (UUPS Proxy)...");
  const AchievementManager = await ethers.getContractFactory("AchievementManager");
  const manager = await upgrades.deployProxy(
    AchievementManager,
    [badgesAddress, itemsAddress, EIGHT_BIT_TOKEN_ADDRESS, BADGE_METADATA_BASE_URI],
    { kind: "uups" }
  );
  await manager.waitForDeployment();
  const managerAddress = await manager.getAddress();
  console.log("  AchievementManager proxy:", managerAddress);
  console.log();

  return { badges, items, manager, badgesAddress, itemsAddress, managerAddress };
}

// ═══════════════════════════════════════════════════════════
// PHASE 3: LINK CONTRACTS + CREATE GOALS
// ═══════════════════════════════════════════════════════════

async function linkAndConfigure(deployer: any, badges: any, items: any, manager: any, managerAddress: string) {
  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║  PHASE 3: LINKING & CONFIGURING CONTRACTS        ║");
  console.log("╚═══════════════════════════════════════════════════╝");
  console.log();

  // 3a. Authorize AchievementManager on AchievementBadges
  console.log("  Authorizing AchievementManager on AchievementBadges...");
  let tx = await badges.setAuthorizedMinter(managerAddress, true);
  await tx.wait();
  console.log("  ✓ Done");

  // 3b. Authorize AchievementManager on TradeableItems
  console.log("  Authorizing AchievementManager on TradeableItems...");
  tx = await items.setAuthorizedMinter(managerAddress, true);
  await tx.wait();
  console.log("  ✓ Done");

  // 3c. Set deployer as authorized verifier (needed for batch migration)
  console.log("  Setting deployer as authorized verifier...");
  tx = await manager.setAuthorizedVerifier(deployer.address, true);
  await tx.wait();
  console.log("  ✓ Done");

  // 3d. Set backend wallet as authorized verifier
  console.log("  Setting backend verifier:", BACKEND_VERIFIER);
  tx = await manager.setAuthorizedVerifier(BACKEND_VERIFIER, true);
  await tx.wait();
  console.log("  ✓ Done");

  // 3e. Authorize AchievementManager as minter on EightBitToken
  //     This is required for 8BIT token rewards to be minted during batchAwardAchievement
  //     The deployer MUST be the EightBitToken owner for this to work
  console.log("  Authorizing AchievementManager as minter on EightBitToken...");
  const tokenAbi = ["function setAuthorizedMinter(address minter, bool authorized) external"];
  const token = new ethers.Contract(EIGHT_BIT_TOKEN_ADDRESS, tokenAbi, deployer);
  tx = await token.setAuthorizedMinter(managerAddress, true);
  await tx.wait();
  console.log("  ✓ Done — AchievementManager can now mint 8BIT rewards");
  console.log();

  // 3f. Create 20 achievement goals
  console.log("  Creating 20 achievement goals...");
  const goalConfigs = getGoalConfigs();

  for (const g of goalConfigs) {
    tx = await manager.createGoal(
      g.name,
      g.desc,
      g.category,
      g.threshold,
      g.gameId,
      g.achievementType,
      g.rewardItem,
      g.rewardTokens
    );
    await tx.wait();
    console.log(`    Goal ${g.achievementType}: ${g.name}`);
  }
  console.log("  ✓ All 20 goals created");
  console.log();
}

// ═══════════════════════════════════════════════════════════
// PHASE 4: MIGRATE TESTNET ACHIEVEMENTS
// ═══════════════════════════════════════════════════════════

async function migrateAchievements(manager: any, goalWallets: Record<number, string[]>) {
  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║  PHASE 4: MIGRATING TESTNET ACHIEVEMENTS         ║");
  console.log("╚═══════════════════════════════════════════════════╝");
  console.log();

  const sortedGoals = Object.entries(goalWallets)
    .map(([k, v]) => [Number(k), v] as [number, string[]])
    .sort((a, b) => a[0] - b[0]);

  let totalMigrated = 0;

  for (const [goalId, wallets] of sortedGoals) {
    if (wallets.length === 0) continue;

    console.log(`  Awarding Goal ${goalId} to ${wallets.length} wallets...`);

    // Split into batches of 25 to avoid gas limit issues
    const BATCH_SIZE = 25;
    for (let i = 0; i < wallets.length; i += BATCH_SIZE) {
      const batch = wallets.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(wallets.length / BATCH_SIZE);

      if (totalBatches > 1) {
        console.log(`    Batch ${batchNum}/${totalBatches} (${batch.length} wallets)...`);
      }

      const tx = await manager.batchAwardAchievement(batch, goalId);
      const receipt = await tx.wait();
      console.log(`    ✓ TX: ${receipt.hash} (gas: ${receipt.gasUsed.toString()})`);

      totalMigrated += batch.length;
    }
  }

  console.log();
  console.log(`  ✓ Migration complete: ${totalMigrated} achievements awarded on mainnet`);
  console.log();
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log();
  console.log("═══════════════════════════════════════════════════");
  console.log("  8-BIT ARCADE — MAINNET NFT DEPLOYMENT + MIGRATION");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Deployer:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  console.log("8BIT Token:", EIGHT_BIT_TOKEN_ADDRESS);
  console.log("Backend Verifier:", BACKEND_VERIFIER);
  console.log();

  // Verify deployer is EightBitToken owner
  const tokenOwnerAbi = ["function owner() view returns (address)"];
  const tokenCheck = new ethers.Contract(EIGHT_BIT_TOKEN_ADDRESS, tokenOwnerAbi, ethers.provider);
  const tokenOwner = await tokenCheck.owner();
  console.log("EightBitToken owner:", tokenOwner);

  if (tokenOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("\n⚠️  WARNING: Deployer is NOT the EightBitToken owner!");
    console.error("   The setAuthorizedMinter call will fail.");
    console.error("   Expected deployer:", tokenOwner);
    console.error("   Actual deployer:", deployer.address);
    console.error("\n   Set PRIVATE_KEY in .env to the token owner's private key.");
    process.exit(1);
  }
  console.log("✓ Deployer IS the EightBitToken owner — can authorize minter");
  console.log();

  // PHASE 1: Query testnet data
  const goalWallets = await queryTestnetAchievements();

  // PHASE 2: Deploy contracts
  const { badges, items, manager, badgesAddress, itemsAddress, managerAddress } =
    await deployContracts(deployer);

  // PHASE 3: Link contracts + create goals
  await linkAndConfigure(deployer, badges, items, manager, managerAddress);

  // PHASE 4: Migrate testnet achievements
  await migrateAchievements(manager, goalWallets);

  // ═══════════════════════════════════════════════════════════
  // DEPLOYMENT SUMMARY
  // ═══════════════════════════════════════════════════════════
  const finalBalance = await ethers.provider.getBalance(deployer.address);

  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║  MAINNET DEPLOYMENT COMPLETE                     ║");
  console.log("╚═══════════════════════════════════════════════════╝");
  console.log();
  console.log("Deployed Contracts:");
  console.log("  AchievementBadges (Soulbound, Proxy):", badgesAddress);
  console.log("  TradeableItems (Tradeable, Proxy):", itemsAddress);
  console.log("  AchievementManager (Proxy):", managerAddress);
  console.log("  EightBitToken:", EIGHT_BIT_TOKEN_ADDRESS);
  console.log();
  console.log("Authorized Verifiers:");
  console.log("  Deployer:", deployer.address);
  console.log("  Backend:", BACKEND_VERIFIER);
  console.log();
  console.log("Gas Used:");
  console.log("  Start balance:", ethers.formatEther(balance), "ETH");
  console.log("  End balance:", ethers.formatEther(finalBalance), "ETH");
  console.log("  Total cost:", ethers.formatEther(balance - finalBalance), "ETH");
  console.log();
  console.log("═══════════════════════════════════════════════════");
  console.log("  NEXT STEPS (manual updates required):");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("1. Update frontend/src/config/contracts.ts:");
  console.log(`   ACHIEVEMENT_BADGES: '${badgesAddress}',`);
  console.log(`   TRADEABLE_ITEMS: '${itemsAddress}',`);
  console.log(`   ACHIEVEMENT_MANAGER: '${managerAddress}',`);
  console.log();
  console.log("2. Update functions/src/config.ts:");
  console.log(`   ACHIEVEMENT_MANAGER_ADDRESS = '${managerAddress}'`);
  console.log();
  console.log("3. Set USE_TESTNET = false in both config files");
  console.log();
  console.log("4. Deploy Firebase Functions:");
  console.log("   cd functions && npm run deploy");
  console.log();
  console.log("5. Verify contracts on Arbiscan:");
  console.log(`   npx hardhat verify --network arbitrumOne ${badgesAddress}`);
  console.log(`   npx hardhat verify --network arbitrumOne ${itemsAddress}`);
  console.log(`   npx hardhat verify --network arbitrumOne ${managerAddress}`);
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
