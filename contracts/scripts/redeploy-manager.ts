import { ethers } from "hardhat";

/**
 * Deploy a FRESH AchievementManager as a proper ERC-1967 proxy.
 * Bypasses the hardhat-upgrades plugin (which deployed the old one incorrectly).
 *
 * This script:
 *   1. Deploys new AchievementManager implementation
 *   2. Deploys ERC1967Proxy pointing to it (with initialize call)
 *   3. Re-creates all 20 goals
 *   4. Sets authorized verifier (backend wallet)
 *   5. Authorizes new manager as minter on AchievementBadges + TradeableItems
 *
 * Because the new manager has a fresh playerGoalCompleted mapping,
 * the scheduled Firebase checker will re-detect all eligible players
 * and mint new badges on the current AchievementBadges contract.
 *
 * USAGE:
 *   npx hardhat run scripts/redeploy-manager.ts --network arbitrumSepolia
 */

// ── Existing contract addresses ──
const BADGES_PROXY = "0x8dE45E3e37f0721D64d63E32da5f37CfaCF9ca9f";
const TRADEABLE_ITEMS = "0x3F09919fba62EAec1295F577D92fbF2555247c44";
const EIGHT_BIT_TOKEN = "0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d";
const BACKEND_VERIFIER = "0x3879aA591532B8a7BCe322Edff8fD09F7FB5dC9B";
const BADGE_METADATA_BASE_URI = "ipfs://bafybeiawba4ueh5zpnfbzfpb2nzlk5nwgt7vou37ushiyrgsvszu6yjzha/";

// Old manager (will be retired)
const OLD_MANAGER = "0xcD7b55b846b5FC306ab1B4D2f30FBd3073315e84";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════");
  console.log("  REDEPLOY AchievementManager (Manual Proxy)");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Deployer:", deployer.address);
  console.log("Badges:", BADGES_PROXY);
  console.log("TradeableItems:", TRADEABLE_ITEMS);
  console.log("EightBitToken:", EIGHT_BIT_TOKEN);
  console.log("Backend verifier:", BACKEND_VERIFIER);
  console.log();

  // ── Step 1: Deploy implementation ──
  console.log("Step 1: Deploying AchievementManager implementation...");
  const AchievementManager = await ethers.getContractFactory("AchievementManager");
  const impl = await AchievementManager.deploy();
  await impl.waitForDeployment();
  const implAddr = await impl.getAddress();
  console.log("  Implementation:", implAddr);
  console.log();

  // ── Step 2: Deploy ERC1967Proxy ──
  console.log("Step 2: Deploying ERC1967Proxy...");
  const initData = AchievementManager.interface.encodeFunctionData("initialize", [
    BADGES_PROXY,
    TRADEABLE_ITEMS,
    EIGHT_BIT_TOKEN,
    BADGE_METADATA_BASE_URI
  ]);
  console.log("  initData:", initData.slice(0, 20) + "...");

  const ERC1967Proxy = await ethers.getContractFactory(
    "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy"
  );
  const proxy = await ERC1967Proxy.deploy(implAddr, initData);
  await proxy.waitForDeployment();
  const proxyAddr = await proxy.getAddress();
  console.log("  Proxy deployed to:", proxyAddr);

  // Connect with AchievementManager ABI
  const manager = AchievementManager.attach(proxyAddr);

  // Verify initialize
  const owner = await manager.owner();
  console.log("  owner():", owner);
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Initialize failed - owner mismatch!");
    process.exit(1);
  }
  console.log("  ✓ Initialize succeeded");
  console.log();

  // ── Step 3: Set authorized verifier ──
  console.log("Step 3: Setting authorized verifiers...");
  let tx = await manager.setAuthorizedVerifier(BACKEND_VERIFIER, true);
  await tx.wait();
  console.log("  ✓ Backend verifier:", BACKEND_VERIFIER);

  // Also authorize deployer (for manual testing)
  tx = await manager.setAuthorizedVerifier(deployer.address, true);
  await tx.wait();
  console.log("  ✓ Deployer as verifier:", deployer.address);
  console.log();

  // ── Step 4: Authorize new manager on AchievementBadges ──
  console.log("Step 4: Authorizing new manager as minter on AchievementBadges...");
  const badges = new ethers.Contract(BADGES_PROXY, [
    "function owner() view returns (address)",
    "function setAuthorizedMinter(address, bool) external",
    "function authorizedMinters(address) view returns (bool)"
  ], deployer);

  // Deauthorize old manager
  try {
    tx = await badges.setAuthorizedMinter(OLD_MANAGER, false);
    await tx.wait();
    console.log("  ✓ Deauthorized old manager on badges");
  } catch (e: any) {
    console.log("  ⚠ Could not deauthorize old manager (may not be authorized)");
  }

  // Authorize new manager
  tx = await badges.setAuthorizedMinter(proxyAddr, true);
  await tx.wait();
  console.log("  ✓ New manager authorized on badges");
  console.log();

  // ── Step 5: Authorize new manager on TradeableItems ──
  console.log("Step 5: Authorizing new manager as minter on TradeableItems...");
  const items = new ethers.Contract(TRADEABLE_ITEMS, [
    "function setAuthorizedMinter(address, bool) external"
  ], deployer);

  try {
    tx = await items.setAuthorizedMinter(OLD_MANAGER, false);
    await tx.wait();
    console.log("  ✓ Deauthorized old manager on items");
  } catch (e: any) {
    console.log("  ⚠ Could not deauthorize old manager on items");
  }

  tx = await items.setAuthorizedMinter(proxyAddr, true);
  await tx.wait();
  console.log("  ✓ New manager authorized on items");
  console.log();

  // ── Step 6: Create all 20 goals ──
  console.log("Step 6: Creating 20 achievement goals...");

  const goalConfigs = [
    // SCORE (4)
    { name: "Space Rocks Master", desc: "Score 25,000 in Space Rocks", category: 0, threshold: 25000, gameId: "space-rocks", achievementType: 1, rewardItem: 0, rewardTokens: ethers.parseEther("500") },
    { name: "Galaxy Ace", desc: "Score 50,000 in Galaxy Fighter", category: 0, threshold: 50000, gameId: "galaxy-fighter", achievementType: 2, rewardItem: 0, rewardTokens: ethers.parseEther("200") },
    { name: "Tetris God", desc: "Score 5,000 in Block Drop", category: 0, threshold: 5000, gameId: "block-drop", achievementType: 3, rewardItem: 0, rewardTokens: ethers.parseEther("300") },
    { name: "Shutout King", desc: "Win 11-0 three times in Paddle Battle", category: 0, threshold: 3, gameId: "paddle-battle", achievementType: 4, rewardItem: 0, rewardTokens: ethers.parseEther("400") },

    // GAMES PLAYED (2)
    { name: "First Steps", desc: "Play 10 games", category: 1, threshold: 10, gameId: "", achievementType: 5, rewardItem: 0, rewardTokens: ethers.parseEther("50") },
    { name: "8-Bit Legend", desc: "Play 1,000 games", category: 1, threshold: 1000, gameId: "", achievementType: 6, rewardItem: 0, rewardTokens: ethers.parseEther("2500") },

    // WINS (1)
    { name: "Tournament Champion", desc: "Win 10 tournaments", category: 2, threshold: 10, gameId: "", achievementType: 7, rewardItem: 0, rewardTokens: ethers.parseEther("1000") },

    // STREAK (2)
    { name: "Week Warrior", desc: "Play 7 days in a row", category: 3, threshold: 7, gameId: "", achievementType: 8, rewardItem: 0, rewardTokens: ethers.parseEther("150") },
    { name: "Century Club", desc: "Play 100 days in a row", category: 3, threshold: 100, gameId: "", achievementType: 9, rewardItem: 0, rewardTokens: ethers.parseEther("5000") },

    // COLLECTION / TIER (3)
    { name: "8Bit Gamer", desc: "Earn 10 achievement badges - Gamer tier unlocked", category: 4, threshold: 10, gameId: "", achievementType: 10, rewardItem: 0, rewardTokens: ethers.parseEther("500") },
    { name: "8Bit Prodigy", desc: "Earn 15 achievement badges - Prodigy tier unlocked", category: 4, threshold: 15, gameId: "", achievementType: 11, rewardItem: 0, rewardTokens: ethers.parseEther("2000") },
    { name: "8Bit God", desc: "Earn 18 achievement badges - the ultimate tier", category: 4, threshold: 18, gameId: "", achievementType: 12, rewardItem: 0, rewardTokens: ethers.parseEther("25000") },

    // SPECIAL (3)
    { name: "Early Adopter", desc: "Be among the first 100 players", category: 6, threshold: 100, gameId: "", achievementType: 13, rewardItem: 0, rewardTokens: ethers.parseEther("500") },
    { name: "Game Explorer", desc: "Play all 12 games at least once", category: 6, threshold: 12, gameId: "", achievementType: 14, rewardItem: 0, rewardTokens: ethers.parseEther("300") },
    { name: "OG Member", desc: "Verified OG community member", category: 6, threshold: 1, gameId: "", achievementType: 15, rewardItem: 0, rewardTokens: ethers.parseEther("1000") },

    // HIDDEN (5)
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
    console.log(`  ✓ Goal ${g.achievementType}: ${g.name}`);
  }
  console.log();

  // ── Verification ──
  console.log("── Verification ──");

  // ERC-1967 slot
  const implSlot = await ethers.provider.getStorage(
    proxyAddr,
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  );
  const implFromSlot = "0x" + implSlot.slice(26);
  console.log("  ERC-1967 impl slot:", implFromSlot);
  console.log("  Match:", implFromSlot.toLowerCase() === implAddr.toLowerCase() ? "✓" : "✗");

  console.log("  owner():", await manager.owner());
  console.log("  achievementBadges():", await manager.achievementBadges());
  console.log("  tradeableItems():", await manager.tradeableItems());
  console.log("  eightBitToken():", await manager.eightBitToken());
  console.log("  nextGoalId():", (await manager.nextGoalId()).toString());
  console.log("  badgeMetadataBaseURI():", await manager.badgeMetadataBaseURI());
  console.log("  New manager on badges?", await badges.authorizedMinters(proxyAddr));
  console.log();

  console.log("═══════════════════════════════════════════════════");
  console.log("  REDEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("NEW AchievementManager (proxy):", proxyAddr);
  console.log("Implementation:", implAddr);
  console.log("OLD AchievementManager:", OLD_MANAGER, "(retired)");
  console.log();
  console.log("playerGoalCompleted is EMPTY → scheduler will re-mint all badges");
  console.log();
  console.log("UPDATE THESE FILES with the new address:");
  console.log("  - frontend/src/config/contracts.ts");
  console.log("  - functions/src/config.ts");
  console.log("  - docs/contracts/addresses.md");
  console.log("  - docs/earning/nft-achievements.md");
  console.log("  - contracts/scripts/*.ts (any that reference old manager)");
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
