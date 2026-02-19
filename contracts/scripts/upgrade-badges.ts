import { ethers } from "hardhat";

/**
 * Upgrade AchievementBadges proxy to new implementation (direct UUPS call)
 *
 * This upgrade changes tokenURI() to compute metadata URIs dynamically from
 * baseTokenURI + achievementTypeId + ".json" instead of using per-token stored URIs.
 *
 * This fixes ALL existing tokens (including previously minted ones with broken URIs)
 * because tokenURI is now derived from the single baseTokenURI on every call.
 *
 * PREREQUISITES:
 * 1. The .env PRIVATE_KEY must be the proxy owner (deployer: 0x8FAF04cA3b0A7463A76F890017379630B2E1313b)
 * 2. After upgrade, run set-base-uri.ts with the correct JSON folder CID
 *
 * USAGE:
 *   npx hardhat run scripts/upgrade-badges.ts --network arbitrumSepolia
 */

const BADGES_PROXY = "0xf70C7814C44D9f93Ab35c77a73f584e114783314";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════");
  console.log("  UPGRADE AchievementBadges PROXY (Direct UUPS)");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Upgrading with account:", deployer.address);
  console.log("Proxy address:", BADGES_PROXY);
  console.log();

  // Step 1: Deploy new implementation contract
  console.log("Step 1: Deploying new AchievementBadges implementation...");
  const AchievementBadges = await ethers.getContractFactory("AchievementBadges");
  const impl = await AchievementBadges.deploy();
  await impl.waitForDeployment();
  const implAddress = await impl.getAddress();
  console.log("  New implementation deployed to:", implAddress);
  console.log();

  // Step 2: Call upgradeToAndCall on the proxy (UUPS pattern)
  console.log("Step 2: Upgrading proxy to new implementation...");
  const proxy = new ethers.Contract(BADGES_PROXY, [
    "function upgradeToAndCall(address newImplementation, bytes data) external",
    "function baseTokenURI() view returns (string)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function nextTokenId() view returns (uint256)"
  ], deployer);

  const tx = await proxy.upgradeToAndCall(implAddress, "0x");
  await tx.wait();
  console.log("  Proxy upgraded! Tx:", tx.hash);
  console.log();

  // Step 3: Verify the upgrade
  console.log("Step 3: Verifying upgrade...");
  const baseURI = await proxy.baseTokenURI();
  const nextId = await proxy.nextTokenId();
  console.log("  baseTokenURI:", baseURI);
  console.log("  nextTokenId:", nextId.toString());

  // If tokens exist, test tokenURI on token #1
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
  console.log("All existing tokens will automatically use the new base URI.");
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
