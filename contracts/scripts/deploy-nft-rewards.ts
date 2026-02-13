import { ethers } from "hardhat";

/**
 * Deployment Script for NFT Goal-Based Rewards System
 *
 * Deploys:
 * 1. AchievementBadges - Soulbound ERC-721 for achievement badges
 * 2. TradeableItems - Standard ERC-721 for tradeable collectibles
 * 3. AchievementManager - Goal tracking and minting coordinator
 *
 * Then links them together and seeds initial goals.
 *
 * PREREQUISITES:
 * - EightBitToken must already be deployed
 * - Update EIGHT_BIT_TOKEN_ADDRESS below with the deployed address
 *
 * DEPLOYMENT:
 *   npx hardhat run scripts/deploy-nft-rewards.ts --network arbitrumSepolia
 */

// ⚠️ UPDATE THIS with your deployed EightBitToken address
const EIGHT_BIT_TOKEN_ADDRESS = "0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d"; // Arbitrum Sepolia

// Metadata base URIs (update with your IPFS/hosting URLs)
const BADGE_METADATA_BASE_URI = "ipfs://YOUR_BADGE_METADATA_CID/";
const ITEM_CONTRACT_URI = "ipfs://YOUR_COLLECTION_METADATA_CID/collection.json";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════");
  console.log("  8-BIT ARCADE - NFT REWARDS SYSTEM DEPLOYMENT");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("8BIT Token:", EIGHT_BIT_TOKEN_ADDRESS);
  console.log();

  // ─── 1. Deploy AchievementBadges (Soulbound) ───
  console.log("📝 Deploying AchievementBadges (Soulbound NFTs)...");
  const AchievementBadges = await ethers.getContractFactory("AchievementBadges");
  const badges = await AchievementBadges.deploy(BADGE_METADATA_BASE_URI);
  await badges.waitForDeployment();
  const badgesAddress = await badges.getAddress();
  console.log("✅ AchievementBadges deployed to:", badgesAddress);
  console.log();

  // ─── 2. Deploy TradeableItems ───
  console.log("📝 Deploying TradeableItems (Tradeable NFTs)...");
  const TradeableItems = await ethers.getContractFactory("TradeableItems");
  const items = await TradeableItems.deploy(
    badgesAddress,       // AchievementBadges for gating
    deployer.address,    // Treasury (update later with real treasury)
    ITEM_CONTRACT_URI
  );
  await items.waitForDeployment();
  const itemsAddress = await items.getAddress();
  console.log("✅ TradeableItems deployed to:", itemsAddress);
  console.log();

  // ─── 3. Deploy AchievementManager ───
  console.log("📝 Deploying AchievementManager...");
  const AchievementManager = await ethers.getContractFactory("AchievementManager");
  const manager = await AchievementManager.deploy(
    badgesAddress,
    itemsAddress,
    EIGHT_BIT_TOKEN_ADDRESS,
    BADGE_METADATA_BASE_URI
  );
  await manager.waitForDeployment();
  const managerAddress = await manager.getAddress();
  console.log("✅ AchievementManager deployed to:", managerAddress);
  console.log();

  // ─── 4. Link contracts together ───
  console.log("🔗 Linking contracts...");

  // Authorize AchievementManager as a minter on AchievementBadges
  console.log("   Authorizing AchievementManager on AchievementBadges...");
  let tx = await badges.setAuthorizedMinter(managerAddress, true);
  await tx.wait();
  console.log("   ✅ AchievementManager can mint badges");

  // Authorize AchievementManager as a minter on TradeableItems
  console.log("   Authorizing AchievementManager on TradeableItems...");
  tx = await items.setAuthorizedMinter(managerAddress, true);
  await tx.wait();
  console.log("   ✅ AchievementManager can mint tradeable items");

  // Set deployer as initial verifier on AchievementManager
  console.log("   Setting deployer as authorized verifier...");
  tx = await manager.setAuthorizedVerifier(deployer.address, true);
  await tx.wait();
  console.log("   ✅ Deployer authorized as verifier");
  console.log();

  // ─── 5. Seed initial achievement goals ───
  console.log("🎯 Creating initial achievement goals...");

  const goalConfigs = [
    // SCORE goals - Game-specific high scores
    { name: "Space Rocks Rookie", desc: "Score 5,000 in Space Rocks", category: 0, threshold: 5000, gameId: "space-rocks", achievementType: 1, rewardItem: 0, rewardTokens: ethers.parseEther("100") },
    { name: "Space Rocks Master", desc: "Score 25,000 in Space Rocks", category: 0, threshold: 25000, gameId: "space-rocks", achievementType: 2, rewardItem: 0, rewardTokens: ethers.parseEther("500") },
    { name: "Alien Slayer", desc: "Score 10,000 in Alien Assault", category: 0, threshold: 10000, gameId: "alien-assault", achievementType: 3, rewardItem: 0, rewardTokens: ethers.parseEther("100") },
    { name: "Brick Breaker Pro", desc: "Score 15,000 in Brick Breaker", category: 0, threshold: 15000, gameId: "brick-breaker", achievementType: 4, rewardItem: 0, rewardTokens: ethers.parseEther("100") },
    { name: "Snake Charmer", desc: "Score 50 in Pixel Snake", category: 0, threshold: 50, gameId: "pixel-snake", achievementType: 5, rewardItem: 0, rewardTokens: ethers.parseEther("100") },

    // GAMES_PLAYED goals - Play count milestones
    { name: "First Steps", desc: "Play 10 games", category: 1, threshold: 10, gameId: "", achievementType: 10, rewardItem: 0, rewardTokens: ethers.parseEther("50") },
    { name: "Regular Player", desc: "Play 100 games", category: 1, threshold: 100, gameId: "", achievementType: 11, rewardItem: 0, rewardTokens: ethers.parseEther("250") },
    { name: "Arcade Veteran", desc: "Play 500 games", category: 1, threshold: 500, gameId: "", achievementType: 12, rewardItem: 0, rewardTokens: ethers.parseEther("1000") },
    { name: "8-Bit Legend", desc: "Play 1,000 games", category: 1, threshold: 1000, gameId: "", achievementType: 13, rewardItem: 0, rewardTokens: ethers.parseEther("2500") },

    // WINS goals - Tournament wins
    { name: "First Victory", desc: "Win your first tournament", category: 2, threshold: 1, gameId: "", achievementType: 20, rewardItem: 0, rewardTokens: ethers.parseEther("200") },
    { name: "Tournament Champion", desc: "Win 10 tournaments", category: 2, threshold: 10, gameId: "", achievementType: 21, rewardItem: 0, rewardTokens: ethers.parseEther("1000") },

    // STREAK goals - Daily play streaks
    { name: "Week Warrior", desc: "Play 7 days in a row", category: 3, threshold: 7, gameId: "", achievementType: 30, rewardItem: 0, rewardTokens: ethers.parseEther("150") },
    { name: "Monthly Grinder", desc: "Play 30 days in a row", category: 3, threshold: 30, gameId: "", achievementType: 31, rewardItem: 0, rewardTokens: ethers.parseEther("750") },

    // COLLECTION goals - Badge collecting
    { name: "Badge Collector", desc: "Earn 5 achievement badges", category: 4, threshold: 5, gameId: "", achievementType: 40, rewardItem: 0, rewardTokens: ethers.parseEther("200") },
    { name: "Badge Master", desc: "Earn 15 achievement badges", category: 4, threshold: 15, gameId: "", achievementType: 41, rewardItem: 0, rewardTokens: ethers.parseEther("1000") },

    // SPECIAL goals - One-time events
    { name: "Early Adopter", desc: "Be among the first 100 players", category: 6, threshold: 100, gameId: "", achievementType: 50, rewardItem: 0, rewardTokens: ethers.parseEther("500") },
    { name: "Game Explorer", desc: "Play all 12 games at least once", category: 6, threshold: 12, gameId: "", achievementType: 51, rewardItem: 0, rewardTokens: ethers.parseEther("300") },

    // ─── NEW: Advanced Achievement Goals ───

    // STREAK goals - Endurance
    { name: "Iron Will", desc: "Play 60 days in a row", category: 3, threshold: 60, gameId: "", achievementType: 32, rewardItem: 0, rewardTokens: ethers.parseEther("2000") },
    { name: "Century Club", desc: "Play 100 days in a row", category: 3, threshold: 100, gameId: "", achievementType: 33, rewardItem: 0, rewardTokens: ethers.parseEther("5000") },

    // WINS goals - Tournament mastery
    { name: "Prize Hoarder", desc: "Earn 100,000 8BIT from tournament winnings", category: 2, threshold: 100000, gameId: "", achievementType: 22, rewardItem: 0, rewardTokens: ethers.parseEther("2500") },

    // SPECIAL goals - Unique challenges
    { name: "Burn Baby Burn", desc: "Burn 100,000 8BIT through tournament entry fees", category: 6, threshold: 100000, gameId: "", achievementType: 52, rewardItem: 0, rewardTokens: ethers.parseEther("2000") },
    { name: "Perfectionist", desc: "Set new personal bests in 5 games in a single day", category: 6, threshold: 5, gameId: "", achievementType: 53, rewardItem: 0, rewardTokens: ethers.parseEther("400") },
    { name: "OG Member", desc: "Verified OG community member", category: 6, threshold: 1, gameId: "", achievementType: 54, rewardItem: 0, rewardTokens: ethers.parseEther("1000") },

    // COLLECTION goal - The ultimate
    { name: "The Completionist", desc: "Earn every other achievement badge", category: 4, threshold: 23, gameId: "", achievementType: 42, rewardItem: 0, rewardTokens: ethers.parseEther("10000") },
  ];

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
    console.log(`   ✅ Goal created: ${g.name}`);
  }
  console.log();

  // ─── 6. Create Tradeable Item Types (earned, not bought) ───
  console.log("🏆 Creating tradeable item types...");

  // 8Bit Gamer: Earn 5 badges, unlimited supply, free, 1 per wallet
  tx = await items.createItemType(
    0,                    // maxSupply (0 = unlimited)
    40,                   // requiredAchievement = Badge Collector (achievementTypeId 40 = 5 badges)
    0,                    // priceInWei = FREE
    1,                    // perWalletCap = 1
    "ipfs://YOUR_BADGE_METADATA_CID/8bit-gamer.json"
  );
  await tx.wait();
  console.log("   ✅ Item Type 1: 8Bit Gamer (5 badges required, free mint)");

  // 8Bit Prodigy: Earn 15 badges, max 1000, free, 1 per wallet
  tx = await items.createItemType(
    1000,                 // maxSupply
    41,                   // requiredAchievement = Badge Master (achievementTypeId 41 = 15 badges)
    0,                    // priceInWei = FREE
    1,                    // perWalletCap = 1
    "ipfs://YOUR_BADGE_METADATA_CID/8bit-prodigy.json"
  );
  await tx.wait();
  console.log("   ✅ Item Type 2: 8Bit Prodigy (15 badges required, max 1000)");

  // 8Bit God: Earn ALL badges (The Completionist), max 100, free, 1 per wallet
  tx = await items.createItemType(
    100,                  // maxSupply
    42,                   // requiredAchievement = The Completionist (achievementTypeId 42)
    0,                    // priceInWei = FREE
    1,                    // perWalletCap = 1
    "ipfs://YOUR_BADGE_METADATA_CID/8bit-god.json"
  );
  await tx.wait();
  console.log("   ✅ Item Type 3: 8Bit God (ALL badges required, max 100)");
  console.log();

  // ─── Summary ───
  console.log("═══════════════════════════════════════════════════");
  console.log("  DEPLOYMENT SUMMARY");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("AchievementBadges (Soulbound):", badgesAddress);
  console.log("TradeableItems (Tradeable):", itemsAddress);
  console.log("AchievementManager:", managerAddress);
  console.log("8BIT Token:", EIGHT_BIT_TOKEN_ADDRESS);
  console.log("Deployer/Verifier:", deployer.address);
  console.log("Initial Goals Created:", goalConfigs.length);
  console.log();
  console.log("⚠️  IMPORTANT NEXT STEPS:");
  console.log("───────────────────────────────────────────────────");
  console.log("1. Update frontend/src/config/contracts.ts with these addresses");
  console.log("2. Authorize AchievementManager as minter on EightBitToken:");
  console.log(`   token.setAuthorizedMinter("${managerAddress}", true)`);
  console.log("3. Set your backend wallet as an authorized verifier:");
  console.log(`   manager.setAuthorizedVerifier(BACKEND_WALLET, true)`);
  console.log("4. Upload badge metadata to IPFS and update base URI:");
  console.log(`   badges.setBaseTokenURI("ipfs://YOUR_CID/")`);
  console.log(`   manager.setBadgeMetadataBaseURI("ipfs://YOUR_CID/")`);
  console.log("5. Create tradeable item types on TradeableItems:");
  console.log(`   items.createItemType(maxSupply, requiredAchievement, priceInWei, perWalletCap, uri)`);
  console.log("6. Verify contracts on Arbiscan:");
  console.log(`   npx hardhat verify --network arbitrumSepolia ${badgesAddress} "${BADGE_METADATA_BASE_URI}"`);
  console.log(`   npx hardhat verify --network arbitrumSepolia ${itemsAddress} "${badgesAddress}" "${deployer.address}" "${ITEM_CONTRACT_URI}"`);
  console.log(`   npx hardhat verify --network arbitrumSepolia ${managerAddress} "${badgesAddress}" "${itemsAddress}" "${EIGHT_BIT_TOKEN_ADDRESS}" "${BADGE_METADATA_BASE_URI}"`);
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
