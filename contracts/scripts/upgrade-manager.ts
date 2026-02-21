import { ethers } from "hardhat";

/**
 * Upgrade AchievementManager proxy to V2 implementation
 * (adds resetPlayerGoalCompletions function)
 *
 * The manager proxy was deployed via upgrades.deployProxy() so it IS a proper
 * ERC-1967 UUPS proxy. We deploy a new implementation and call upgradeToAndCall.
 *
 * USAGE:
 *   npx hardhat run scripts/upgrade-manager.ts --network arbitrumSepolia
 */

const MANAGER_PROXY = "0xE68d3AdD44C541fF76C85D185d02BE5ceAC833B3";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════");
  console.log("  UPGRADE AchievementManager (UUPS)");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Deployer:", deployer.address);
  console.log("Manager proxy:", MANAGER_PROXY);
  console.log();

  // ── Pre-flight: verify ownership ──
  const manager = new ethers.Contract(MANAGER_PROXY, [
    "function owner() view returns (address)"
  ], deployer);

  const owner = await manager.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ ABORT: You don't own the AchievementManager!");
    console.error("   Owner is:", owner);
    process.exit(1);
  }
  console.log("✓ You own the AchievementManager");

  // Verify it's a proper ERC-1967 proxy by checking implementation slot
  const ERC1967_IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const currentImplSlot = await ethers.provider.getStorage(MANAGER_PROXY, ERC1967_IMPL_SLOT);
  const currentImpl = "0x" + currentImplSlot.slice(26);
  if (currentImpl === "0x" + "0".repeat(40)) {
    console.error("❌ ABORT: ERC-1967 implementation slot is EMPTY — not a proxy!");
    process.exit(1);
  }
  console.log("✓ ERC-1967 proxy confirmed, current impl:", currentImpl);

  // ── Step 1: Deploy new implementation ──
  console.log();
  console.log("Step 1: Deploying new AchievementManager implementation...");
  const AchievementManager = await ethers.getContractFactory("AchievementManager");
  const newImpl = await AchievementManager.deploy();
  await newImpl.waitForDeployment();
  const newImplAddr = await newImpl.getAddress();
  console.log("  New implementation:", newImplAddr);

  // ── Step 2: Upgrade proxy ──
  console.log();
  console.log("Step 2: Calling upgradeToAndCall on proxy...");
  const upgradeProxy = new ethers.Contract(MANAGER_PROXY, [
    "function upgradeToAndCall(address, bytes) external"
  ], deployer);

  const tx = await upgradeProxy.upgradeToAndCall(newImplAddr, "0x");
  await tx.wait();
  console.log("  Done:", tx.hash);

  // ── Verify ──
  console.log();
  console.log("── Verification ──");

  // Check implementation slot
  const implSlot = await ethers.provider.getStorage(
    MANAGER_PROXY,
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  );
  const implFromSlot = "0x" + implSlot.slice(26);
  console.log("  ERC-1967 impl slot:", implFromSlot);
  console.log("  Expected:", newImplAddr.toLowerCase());
  console.log("  Match:", implFromSlot.toLowerCase() === newImplAddr.toLowerCase() ? "✓" : "✗");

  // Verify state preserved
  const managerV2 = new ethers.Contract(MANAGER_PROXY, [
    "function owner() view returns (address)",
    "function achievementBadges() view returns (address)",
    "function nextGoalId() view returns (uint256)",
    "function totalAchievementsAwarded() view returns (uint256)",
    "function badgeMetadataBaseURI() view returns (string)"
  ], deployer);

  console.log("  owner():", await managerV2.owner());
  console.log("  achievementBadges():", await managerV2.achievementBadges());
  console.log("  nextGoalId():", (await managerV2.nextGoalId()).toString());
  console.log("  totalAchievementsAwarded():", (await managerV2.totalAchievementsAwarded()).toString());
  console.log("  badgeMetadataBaseURI():", await managerV2.badgeMetadataBaseURI());

  console.log();
  console.log("═══════════════════════════════════════════════════");
  console.log("  UPGRADE COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("AchievementManager proxy:", MANAGER_PROXY);
  console.log("New implementation:", newImplAddr);
  console.log();
  console.log("New function available: resetPlayerGoalCompletions(address[], uint256[])");
  console.log();
  console.log("NEXT: Run scripts/reset-achievements.ts to reset old completions");
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
