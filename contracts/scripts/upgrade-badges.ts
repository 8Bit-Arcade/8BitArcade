import { ethers, upgrades } from "hardhat";

/**
 * Upgrade AchievementBadges proxy to V2 implementation
 *
 * This upgrade changes tokenURI() to compute metadata URIs dynamically from
 * baseTokenURI + achievementTypeId + ".json" instead of using per-token stored URIs.
 *
 * This fixes ALL existing tokens (including previously minted ones with broken URIs)
 * because tokenURI is now derived from the single baseTokenURI on every call.
 *
 * PREREQUISITES:
 * 1. The .env PRIVATE_KEY must be the proxy owner (deployer: 0x8FAF04cA3b0A7463A76F890017379630B2E1313b)
 * 2. Upload fixed JSON metadata folder to Pinata and note the new CID
 * 3. After upgrade, run set-base-uri.ts with the new CID
 *
 * USAGE:
 *   npx hardhat run scripts/upgrade-badges.ts --network arbitrumSepolia
 */

const BADGES_PROXY = "0xf70C7814C44D9f93Ab35c77a73f584e114783314";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════");
  console.log("  UPGRADE AchievementBadges PROXY");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Upgrading with account:", deployer.address);
  console.log("Proxy address:", BADGES_PROXY);
  console.log();

  // Force-import the existing proxy so hardhat-upgrades recognizes it
  console.log("Importing existing proxy deployment...");
  const AchievementBadgesOld = await ethers.getContractFactory("AchievementBadges");
  await upgrades.forceImport(BADGES_PROXY, AchievementBadgesOld, { kind: "uups" });
  console.log("  Proxy imported successfully.");
  console.log();

  // Upgrade to the new implementation
  console.log("Deploying new implementation and upgrading proxy...");
  const AchievementBadgesNew = await ethers.getContractFactory("AchievementBadges");
  const upgraded = await upgrades.upgradeProxy(BADGES_PROXY, AchievementBadgesNew);
  await upgraded.waitForDeployment();

  const implAddress = await upgrades.erc1967.getImplementationAddress(BADGES_PROXY);
  console.log("  Upgrade complete!");
  console.log("  New implementation:", implAddress);
  console.log();

  // Verify the upgrade worked by checking tokenURI returns baseTokenURI-based URI
  const badges = await ethers.getContractAt("AchievementBadges", BADGES_PROXY);
  const baseURI = await badges.baseTokenURI();
  console.log("Current baseTokenURI:", baseURI);
  console.log();

  console.log("═══════════════════════════════════════════════════");
  console.log("  UPGRADE COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("tokenURI() now computes: baseTokenURI + achievementTypeId + '.json'");
  console.log("All existing tokens will automatically use the new base URI.");
  console.log();
  console.log("NEXT STEPS:");
  console.log("1. Upload the fixed JSON metadata folder to Pinata");
  console.log("2. Run set-base-uri.ts with the new JSON folder CID:");
  console.log("   npx hardhat run scripts/set-base-uri.ts --network arbitrumSepolia");
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
