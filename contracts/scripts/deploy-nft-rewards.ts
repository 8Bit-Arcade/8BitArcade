import { ethers, upgrades } from "hardhat";

/**
 * Deployment Script for NFT Goal-Based Rewards System (UUPS Proxies)
 *
 * Deploys:
 * 1. AchievementBadges - Soulbound ERC-721 (UUPS proxy)
 * 2. TradeableItems - Standard ERC-721 (UUPS proxy)
 * 3. AchievementManager - Goal tracking coordinator (UUPS proxy)
 *
 * Then links them together and seeds 20 achievement goals.
 *
 * PREREQUISITES:
 * - EightBitToken must already be deployed
 * - Update EIGHT_BIT_TOKEN_ADDRESS below with the deployed address
 *
 * DEPLOYMENT:
 *   npx hardhat run scripts/deploy-nft-rewards.ts --network arbitrumSepolia
 */

// UPDATE THIS with your deployed EightBitToken address
const EIGHT_BIT_TOKEN_ADDRESS = "0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d"; // Arbitrum Sepolia

// Metadata base URIs (update with your IPFS/hosting URLs)
const BADGE_METADATA_BASE_URI = "ipfs://YOUR_BADGE_METADATA_CID/";
const ITEM_CONTRACT_URI = "ipfs://YOUR_COLLECTION_METADATA_CID/collection.json";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════");
  console.log("  8-BIT ARCADE - NFT REWARDS SYSTEM DEPLOYMENT");
  console.log("  (UUPS Upgradeable Proxies)");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("8BIT Token:", EIGHT_BIT_TOKEN_ADDRESS);
  console.log();

  // ─── 1. Deploy AchievementBadges (Soulbound, UUPS Proxy) ───
  console.log("Deploying AchievementBadges (Soulbound NFTs, UUPS Proxy)...");
  const AchievementBadges = await ethers.getContractFactory("AchievementBadges");
  const badges = await upgrades.deployProxy(
    AchievementBadges,
    [BADGE_METADATA_BASE_URI],
    { kind: "uups" }
  );
  await badges.waitForDeployment();
  const badgesAddress = await badges.getAddress();
  console.log("AchievementBadges proxy deployed to:", badgesAddress);
  console.log();

  // ─── 2. Deploy TradeableItems (8BIT token payments, UUPS Proxy) ───
  console.log("Deploying TradeableItems (Tradeable NFTs, UUPS Proxy)...");
  const TradeableItems = await ethers.getContractFactory("TradeableItems");
  const items = await upgrades.deployProxy(
    TradeableItems,
    [badgesAddress, EIGHT_BIT_TOKEN_ADDRESS, deployer.address, ITEM_CONTRACT_URI],
    { kind: "uups" }
  );
  await items.waitForDeployment();
  const itemsAddress = await items.getAddress();
  console.log("TradeableItems proxy deployed to:", itemsAddress);
  console.log();

  // ─── 3. Deploy AchievementManager (UUPS Proxy) ───
  console.log("Deploying AchievementManager (UUPS Proxy)...");
  const AchievementManager = await ethers.getContractFactory("AchievementManager");
  const manager = await upgrades.deployProxy(
    AchievementManager,
    [badgesAddress, itemsAddress, EIGHT_BIT_TOKEN_ADDRESS, BADGE_METADATA_BASE_URI],
    { kind: "uups" }
  );
  await manager.waitForDeployment();
  const managerAddress = await manager.getAddress();
  console.log("AchievementManager proxy deployed to:", managerAddress);
  console.log();

  // ─── 4. Link contracts together ───
  console.log("Linking contracts...");

  console.log("   Authorizing AchievementManager on AchievementBadges...");
  let tx = await badges.setAuthorizedMinter(managerAddress, true);
  await tx.wait();

  console.log("   Authorizing AchievementManager on TradeableItems...");
  tx = await items.setAuthorizedMinter(managerAddress, true);
  await tx.wait();

  console.log("   Setting deployer as authorized verifier...");
  tx = await manager.setAuthorizedVerifier(deployer.address, true);
  await tx.wait();
  console.log();

  // ─── 5. Seed 20 achievement goals (15 standard + 5 hidden) ───
  console.log("Creating 20 achievement goals...");

  const goalConfigs = [
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
    console.log(`   Goal created: ${g.name} (ID: ${g.achievementType})`);
  }
  console.log();

  // ─── Summary ───
  console.log("═══════════════════════════════════════════════════");
  console.log("  DEPLOYMENT SUMMARY (UUPS PROXIES)");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("AchievementBadges (Soulbound, Proxy):", badgesAddress);
  console.log("TradeableItems (Tradeable, Proxy):", itemsAddress);
  console.log("AchievementManager (Proxy):", managerAddress);
  console.log("8BIT Token:", EIGHT_BIT_TOKEN_ADDRESS);
  console.log("Deployer/Verifier:", deployer.address);
  console.log("Goals Created:", goalConfigs.length, "(15 standard + 5 hidden)");
  console.log();
  console.log("SOULBOUND BADGE TIERS:");
  console.log("  8Bit Gamer    = 10 badges (ID: 10)");
  console.log("  8Bit Prodigy  = 15 badges (ID: 11)");
  console.log("  8Bit God      = 18 badges (ID: 12)");
  console.log();
  console.log("HIDDEN ACHIEVEMENTS (5):");
  console.log("  Lucky 777          (ID: 16) - Score exactly 777");
  console.log("  Night Owl          (ID: 17) - Play at 3:00-3:05 AM UTC");
  console.log("  Palindrome Master  (ID: 18) - Palindrome score over 1000");
  console.log("  Double Trouble     (ID: 19) - Same score in 2 different games");
  console.log("  The Answer         (ID: 20) - Score exactly 42");
  console.log();
  console.log("TRADEABLE ITEMS: None pre-created. Add later via:");
  console.log(`  items.createItemType(maxSupply, requiredAchievement, priceInTokens, perWalletCap, uri)`);
  console.log();
  console.log("UPGRADES: All contracts use UUPS proxy pattern. To upgrade:");
  console.log("  const NewImpl = await ethers.getContractFactory('AchievementBadgesV2');");
  console.log("  await upgrades.upgradeProxy(proxyAddress, NewImpl);");
  console.log();
  console.log("NEXT STEPS:");
  console.log("───────────────────────────────────────────────────");
  console.log("1. Update frontend/src/config/contracts.ts with proxy addresses");
  console.log("2. Authorize AchievementManager as minter on EightBitToken:");
  console.log(`   token.setAuthorizedMinter("${managerAddress}", true)`);
  console.log("3. Set your backend wallet as authorized verifier:");
  console.log(`   manager.setAuthorizedVerifier(BACKEND_WALLET, true)`);
  console.log("4. Upload badge metadata to IPFS and update base URI");
  console.log("5. When ready, create tradeable item types on TradeableItems");
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
