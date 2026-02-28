import { ethers } from "hardhat";

/**
 * Update badge metadata base URI on mainnet contracts
 *
 * After re-uploading the metadata/badges/ folder to Pinata (with updated
 * image URLs pointing to your Pinata gateway), replace NEW_CID below with
 * the new folder CID from Pinata, then run:
 *
 *   npx hardhat run scripts/update-base-uri-mainnet.ts --network arbitrumOne
 */

// ── MAINNET CONTRACT ADDRESSES ──
const BADGES  = "0x5b0ee0abc08fA668c6B215CCD9f9A28a77789d2c";
const MANAGER = "0xF9f1067873bCe779D35e8796bfE9A32EFf5DAF1f";

// ── UPDATE THIS after re-uploading to Pinata ──
const NEW_CID = "bafybeicq2vgfk3uk3jq7hw5kxkxjvp25xf6qicpnaxc3hdhqlnd5nwwipm";
const BASE_URI = `https://orange-encouraging-perch-476.mypinata.cloud/ipfs/${NEW_CID}/badges/`;

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log();
  console.log("═══════════════════════════════════════════════════");
  console.log("  Update Base URI on Mainnet");
  console.log("═══════════════════════════════════════════════════");
  console.log("Deployer:", deployer.address);
  console.log("New base URI:", BASE_URI);
  console.log();

  if (NEW_CID === "PASTE_NEW_CID_HERE") {
    console.error("ERROR: Replace NEW_CID with the CID from Pinata first!");
    process.exit(1);
  }

  // Update AchievementBadges
  console.log("Setting URI on AchievementBadges...");
  const badges = new ethers.Contract(BADGES, [
    "function setBaseTokenURI(string) external",
    "function baseTokenURI() view returns (string)",
  ], deployer);

  let tx = await badges.setBaseTokenURI(BASE_URI);
  await tx.wait();
  console.log("  ✓ TX:", tx.hash);

  // Update AchievementManager
  console.log("Setting URI on AchievementManager...");
  const manager = new ethers.Contract(MANAGER, [
    "function setBadgeMetadataBaseURI(string) external",
    "function badgeMetadataBaseURI() view returns (string)",
  ], deployer);

  tx = await manager.setBadgeMetadataBaseURI(BASE_URI);
  await tx.wait();
  console.log("  ✓ TX:", tx.hash);

  // Verify
  console.log();
  console.log("Verifying...");
  const badgesURI = await badges.baseTokenURI();
  const managerURI = await manager.badgeMetadataBaseURI();
  console.log("  Badges baseTokenURI:", badgesURI);
  console.log("  Manager baseURI:    ", managerURI);
  console.log("  Match:", badgesURI === managerURI ? "YES" : "NO <<<< PROBLEM");
  console.log();
  console.log("═══════════════════════════════════════════════════");
  console.log("  DONE — tokenURI for all badges now uses new metadata");
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
