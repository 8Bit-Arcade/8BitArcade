import { ethers } from "hardhat";

/**
 * Deploy a FRESH AchievementBadges proxy (manual ERC1967Proxy deployment)
 * Bypasses the hardhat-upgrades plugin entirely.
 *
 * Reuses the already-deployed implementation - NO new implementation deployed.
 *
 * USAGE:
 *   npx hardhat run scripts/redeploy-badges.ts --network arbitrumSepolia
 */

const MANAGER = "0xE68d3AdD44C541fF76C85D185d02BE5ceAC833B3";
const BASE_URI = "ipfs://bafybeiawba4ueh5zpnfbzfpb2nzlk5nwgt7vou37ushiyrgsvszu6yjzha/";

// Reuse already-deployed implementation (has the fixed tokenURI logic)
const IMPL_ADDRESS = "0x340809FBB22C32a6a4D73E10102a760B7a5e4444";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════");
  console.log("  REDEPLOY AchievementBadges (Manual Proxy)");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Deployer:", deployer.address);
  console.log("Implementation:", IMPL_ADDRESS);
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

  // Verify implementation exists on-chain
  const implCode = await ethers.provider.getCode(IMPL_ADDRESS);
  if (implCode === "0x") {
    console.error("❌ ABORT: No contract at implementation address!");
    process.exit(1);
  }
  console.log("✓ Implementation contract verified on-chain");
  console.log();

  // ── Step 1: Deploy ERC1967Proxy pointing to existing implementation ──
  console.log("Step 1: Deploying ERC1967Proxy...");

  // Encode the initialize(BASE_URI) call
  const AchievementBadges = await ethers.getContractFactory("AchievementBadges");
  const initData = AchievementBadges.interface.encodeFunctionData("initialize", [BASE_URI]);
  console.log("  initData:", initData.slice(0, 20) + "...");

  // Deploy the proxy with (implementation, initData)
  const ERC1967Proxy = await ethers.getContractFactory(
    "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy"
  );
  const proxy = await ERC1967Proxy.deploy(IMPL_ADDRESS, initData);
  await proxy.waitForDeployment();
  const proxyAddr = await proxy.getAddress();
  console.log("  Proxy deployed to:", proxyAddr);
  console.log();

  // Connect to the proxy with the AchievementBadges ABI
  const badges = AchievementBadges.attach(proxyAddr);

  // Quick verify initialize worked
  const owner = await badges.owner();
  console.log("  owner():", owner);
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Initialize may have failed - owner mismatch!");
    process.exit(1);
  }
  console.log("  ✓ Initialize succeeded");
  console.log();

  // ── Step 2: Wire into AchievementManager ──
  console.log("Step 2: Pointing AchievementManager to new badges contract...");
  let tx = await manager.setAchievementBadges(proxyAddr);
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

  // Verify ERC-1967 implementation slot is set
  const implSlot = await ethers.provider.getStorage(
    proxyAddr,
    "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
  );
  console.log("  ERC-1967 impl slot:", "0x" + implSlot.slice(26));
  console.log();

  console.log("═══════════════════════════════════════════════════");
  console.log("  REDEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("NEW AchievementBadges (proxy):", proxyAddr);
  console.log("Implementation:", IMPL_ADDRESS);
  console.log("OLD AchievementBadges: 0xf70C7814C44D9f93Ab35c77a73f584e114783314 (retired)");
  console.log();
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
