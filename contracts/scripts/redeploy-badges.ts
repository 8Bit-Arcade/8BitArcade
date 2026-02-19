import { ethers } from "hardhat";

/**
 * Deploy a FRESH AchievementBadges contract (not a proxy - direct deploy)
 * and wire it into the existing AchievementManager.
 *
 * The new contract has a fixed tokenURI that computes from baseTokenURI,
 * so updating baseTokenURI fixes ALL tokens automatically.
 *
 * WHAT THIS DOES:
 * 1. Deploys new AchievementBadges (direct, no proxy)
 * 2. Calls setAchievementBadges on AchievementManager to point to the new contract
 * 3. Authorizes AchievementManager as a minter on the new contract
 * 4. Sets baseTokenURI on the new contract
 *
 * PREREQUISITES:
 * - .env PRIVATE_KEY = deployer wallet (0x8FAF) which owns AchievementManager
 * - Update BASE_URI below with your Pinata JSON folder CID
 *
 * USAGE:
 *   npx hardhat run scripts/redeploy-badges.ts --network arbitrumSepolia
 */

const MANAGER = "0xcD7b55b846b5FC306ab1B4D2f30FBd3073315e84";
const BASE_URI = "ipfs://bafybeiawba4ueh5zpnfbzfpb2nzlk5nwgt7vou37ushiyrgsvszu6yjzha/";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════");
  console.log("  REDEPLOY AchievementBadges (Fresh Contract)");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Deployer:", deployer.address);
  console.log("AchievementManager:", MANAGER);
  console.log("Base URI:", BASE_URI);
  console.log();

  // ── Pre-flight: verify we own the manager ──
  const manager = new ethers.Contract(MANAGER, [
    "function owner() view returns (address)",
    "function setAchievementBadges(address) external",
    "function setBadgeMetadataBaseURI(string) external"
  ], deployer);

  const managerOwner = await manager.owner();
  if (managerOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ ABORT: You don't own the AchievementManager!");
    console.error("   Owner is:", managerOwner);
    process.exit(1);
  }
  console.log("✓ You own the AchievementManager");
  console.log();

  // ── Step 1: Deploy new AchievementBadges ──
  console.log("Step 1: Deploying new AchievementBadges...");
  const AchievementBadges = await ethers.getContractFactory("AchievementBadges");
  const badges = await AchievementBadges.deploy();
  await badges.waitForDeployment();
  const badgesAddr = await badges.getAddress();
  console.log("  Deployed to:", badgesAddr);

  // Initialize it (since constructor only disables initializers)
  console.log("  Initializing...");
  const initTx = await badges.initialize(BASE_URI);
  await initTx.wait();
  console.log("  Initialized with baseTokenURI:", BASE_URI);
  console.log();

  // ── Step 2: Wire into AchievementManager ──
  console.log("Step 2: Pointing AchievementManager to new badges contract...");
  let tx = await manager.setAchievementBadges(badgesAddr);
  await tx.wait();
  console.log("  Done:", tx.hash);
  console.log();

  // ── Step 3: Authorize AchievementManager as minter ──
  console.log("Step 3: Authorizing AchievementManager as minter...");
  tx = await badges.setAuthorizedMinter(MANAGER, true);
  await tx.wait();
  console.log("  Done:", tx.hash);
  console.log();

  // ── Step 4: Update badgeMetadataBaseURI on AchievementManager too ──
  console.log("Step 4: Setting badgeMetadataBaseURI on AchievementManager...");
  tx = await manager.setBadgeMetadataBaseURI(BASE_URI);
  await tx.wait();
  console.log("  Done:", tx.hash);
  console.log();

  // ── Verify ──
  console.log("── Verification ──");
  const newBadges = new ethers.Contract(badgesAddr, [
    "function owner() view returns (address)",
    "function baseTokenURI() view returns (string)",
    "function authorizedMinters(address) view returns (bool)",
    "function nextTokenId() view returns (uint256)"
  ], deployer);

  console.log("  owner():", await newBadges.owner());
  console.log("  baseTokenURI():", await newBadges.baseTokenURI());
  console.log("  Manager authorized?", await newBadges.authorizedMinters(MANAGER));
  console.log("  nextTokenId():", (await newBadges.nextTokenId()).toString());
  console.log();

  console.log("═══════════════════════════════════════════════════");
  console.log("  REDEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("NEW AchievementBadges:", badgesAddr);
  console.log("OLD AchievementBadges: 0xf70C7814C44D9f93Ab35c77a73f584e114783314 (retired)");
  console.log();
  console.log("All new badges will mint to the new contract with working images.");
  console.log("Old badges on the retired contract remain but are superseded.");
  console.log();
  console.log("UPDATE THESE FILES with the new address:");
  console.log("  - frontend/src/config/contracts.ts");
  console.log("  - docs/contracts/addresses.md");
  console.log("  - functions/src/config.ts (if badges address referenced)");
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
