import { ethers, upgrades } from "hardhat";

/**
 * Deploy a FRESH AchievementBadges via UUPS proxy and wire it into
 * the existing AchievementManager.
 *
 * WHAT THIS DOES:
 * 1. Deploys new AchievementBadges via UUPS proxy (upgrades.deployProxy)
 * 2. Calls setAchievementBadges on AchievementManager to point to new contract
 * 3. Authorizes AchievementManager as minter on new contract
 * 4. Sets badgeMetadataBaseURI on AchievementManager
 *
 * PREREQUISITES:
 * - .env PRIVATE_KEY = deployer wallet (0x8FAF) which owns AchievementManager
 *
 * USAGE:
 *   npx hardhat run scripts/redeploy-badges.ts --network arbitrumSepolia
 */

const MANAGER = "0xcD7b55b846b5FC306ab1B4D2f30FBd3073315e84";
const BASE_URI = "ipfs://bafybeiawba4ueh5zpnfbzfpb2nzlk5nwgt7vou37ushiyrgsvszu6yjzha/";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════");
  console.log("  REDEPLOY AchievementBadges (UUPS Proxy)");
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

  // ── Step 1: Deploy new AchievementBadges via UUPS proxy ──
  console.log("Step 1: Deploying new AchievementBadges (UUPS proxy)...");
  const AchievementBadges = await ethers.getContractFactory("AchievementBadges");
  const badges = await upgrades.deployProxy(
    AchievementBadges,
    [BASE_URI],
    { kind: "uups" }
  );
  await badges.waitForDeployment();
  const badgesAddr = await badges.getAddress();
  console.log("  Proxy deployed to:", badgesAddr);
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

  // ── Step 4: Update badgeMetadataBaseURI on AchievementManager ──
  console.log("Step 4: Setting badgeMetadataBaseURI on AchievementManager...");
  tx = await manager.setBadgeMetadataBaseURI(BASE_URI);
  await tx.wait();
  console.log("  Done:", tx.hash);
  console.log();

  // ── Verify ──
  console.log("── Verification ──");
  console.log("  owner():", await badges.owner());
  console.log("  baseTokenURI():", await badges.baseTokenURI());
  console.log("  Manager authorized?", await badges.authorizedMinters(MANAGER));
  console.log("  nextTokenId():", (await badges.nextTokenId()).toString());
  console.log();

  console.log("═══════════════════════════════════════════════════");
  console.log("  REDEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("NEW AchievementBadges (proxy):", badgesAddr);
  console.log("OLD AchievementBadges: 0xf70C7814C44D9f93Ab35c77a73f584e114783314 (retired)");
  console.log();
  console.log("All new badges will mint to the new contract with working images.");
  console.log("tokenURI computes: baseTokenURI + achievementTypeId + '.json'");
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
