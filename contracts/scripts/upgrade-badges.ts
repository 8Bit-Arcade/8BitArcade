import { ethers } from "hardhat";

/**
 * Upgrade AchievementBadges proxy to new implementation (direct UUPS call)
 *
 * This upgrade changes tokenURI() to compute metadata URIs dynamically from
 * baseTokenURI + achievementTypeId + ".json" instead of using per-token stored URIs.
 *
 * USAGE:
 *   npx hardhat run scripts/upgrade-badges.ts --network arbitrumSepolia
 */

const BADGES_PROXY = "0xf70C7814C44D9f93Ab35c77a73f584e114783314";

// Reuse the implementation already deployed (no need to deploy again)
// Set to "" to deploy a fresh implementation instead
const EXISTING_IMPL = "0x340809FBB22C32a6a4D73E10102a760B7a5e4444";

async function main() {
  const [signer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════");
  console.log("  UPGRADE AchievementBadges PROXY (Direct UUPS)");
  console.log("═══════════════════════════════════════════════════");
  console.log();

  // ── PRE-FLIGHT CHECKS ──────────────────────────────────────
  const proxy = new ethers.Contract(BADGES_PROXY, [
    "function owner() view returns (address)",
    "function upgradeToAndCall(address newImplementation, bytes data) external",
    "function baseTokenURI() view returns (string)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function nextTokenId() view returns (uint256)"
  ], signer);

  const owner = await proxy.owner();
  console.log("Proxy owner:    ", owner);
  console.log("Your wallet:    ", signer.address);
  console.log();

  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    console.error("❌ ABORT: Your wallet is NOT the proxy owner!");
    console.error("   Change PRIVATE_KEY in .env to the owner wallet:", owner);
    console.error("   Then run this script again.");
    process.exit(1);
  }
  console.log("✓ Ownership check passed");

  // ── DETERMINE IMPLEMENTATION ADDRESS ───────────────────────
  let implAddress = EXISTING_IMPL;

  if (!implAddress) {
    console.log("Deploying new AchievementBadges implementation...");
    const AchievementBadges = await ethers.getContractFactory("AchievementBadges");
    const impl = await AchievementBadges.deploy();
    await impl.waitForDeployment();
    implAddress = await impl.getAddress();
    console.log("  New implementation deployed to:", implAddress);
  } else {
    console.log("✓ Reusing existing implementation:", implAddress);
  }
  console.log();

  // ── UPGRADE ────────────────────────────────────────────────
  console.log("Upgrading proxy to new implementation...");
  const tx = await proxy.upgradeToAndCall(implAddress, "0x");
  await tx.wait();
  console.log("  Proxy upgraded! Tx:", tx.hash);
  console.log();

  // ── VERIFY ─────────────────────────────────────────────────
  console.log("Verifying upgrade...");
  const baseURI = await proxy.baseTokenURI();
  const nextId = await proxy.nextTokenId();
  console.log("  baseTokenURI:", baseURI);
  console.log("  nextTokenId:", nextId.toString());

  if (nextId > 1n) {
    const uri = await proxy.tokenURI(1);
    console.log("  tokenURI(1):", uri);
  }
  console.log();

  console.log("═══════════════════════════════════════════════════");
  console.log("  UPGRADE COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("New implementation:", implAddress);
  console.log("tokenURI() now computes: baseTokenURI + achievementTypeId + '.json'");
  console.log();
  console.log("NEXT STEP: Set the base URI on both contracts:");
  console.log("  npx hardhat run scripts/set-base-uri.ts --network arbitrumSepolia");
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
