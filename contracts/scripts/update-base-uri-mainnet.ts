import { ethers } from "hardhat";

/**
 * FIX: Update badge metadata base URI on mainnet contracts
 *
 * PROBLEM:
 *   The original deployment CID (bafybeicq7qg...) returns HTTP 403 on Pinata.
 *   This means Arbiscan/OpenSea/wallets cannot fetch tokenURI metadata,
 *   so NFT images show as broken/placeholder.
 *
 * FIX:
 *   Update baseTokenURI to point to the re-uploaded CID (bafybeicq2vg...)
 *   which returns HTTP 200 and contains correct metadata + image links.
 *
 * METADATA CHAIN (after fix):
 *   tokenURI(tokenId) → baseTokenURI + achievementTypeId + ".json"
 *     → https://.../ipfs/bafybeicq2vg.../badges/{id}.json     (HTTP 200)
 *       → "image": "https://.../ipfs/bafybeice4he.../{id}.png" (HTTP 200)
 *
 * RUN:
 *   cd contracts
 *   npx hardhat run scripts/update-base-uri-mainnet.ts --network arbitrumOne
 */

// ── MAINNET CONTRACT ADDRESSES ──
const BADGES  = "0x5b0ee0abc08fA668c6B215CCD9f9A28a77789d2c";
const MANAGER = "0xF9f1067873bCe779D35e8796bfE9A32EFf5DAF1f";

// ── WORKING CID (verified accessible) ──
const NEW_CID = "bafybeicq2vgfk3uk3jq7hw5kxkxjvp25xf6qicpnaxc3hdhqlnd5nwwipm";
const BASE_URI = `https://orange-encouraging-perch-476.mypinata.cloud/ipfs/${NEW_CID}/badges/`;

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log();
  console.log("═══════════════════════════════════════════════════");
  console.log("  FIX: Update Base URI on Mainnet");
  console.log("═══════════════════════════════════════════════════");
  console.log("Deployer:", deployer.address);
  console.log("New base URI:", BASE_URI);
  console.log();

  // ── PRE-FLIGHT: Verify new metadata is accessible ──
  console.log("Pre-flight: Checking new metadata accessibility...");
  try {
    const metadataUrl = `${BASE_URI}1.json`;
    const res = await fetch(metadataUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.error(`  ✗ FAILED: ${metadataUrl} returned HTTP ${res.status}`);
      console.error("  The new CID is not accessible. Aborting.");
      process.exit(1);
    }
    const json = await res.json();
    console.log(`  ✓ Metadata accessible: "${json.name}"`);

    // Also check that the image URL inside the metadata is accessible
    if (json.image) {
      const imgRes = await fetch(json.image, { method: "HEAD", signal: AbortSignal.timeout(15000) });
      if (imgRes.ok) {
        console.log(`  ✓ Image accessible: ${json.image}`);
      } else {
        console.warn(`  ⚠ Image returned HTTP ${imgRes.status}: ${json.image}`);
        console.warn("  Continuing anyway — metadata is correct, images may resolve later.");
      }
    }
  } catch (e: any) {
    console.error("  ✗ Pre-flight check failed:", e.message);
    console.error("  Cannot verify new metadata. Aborting.");
    process.exit(1);
  }
  console.log();

  // ── PRE-FLIGHT: Read current URI ──
  console.log("Pre-flight: Reading current on-chain baseTokenURI...");
  const badges = new ethers.Contract(BADGES, [
    "function setBaseTokenURI(string) external",
    "function baseTokenURI() view returns (string)",
    "function owner() view returns (address)",
  ], deployer);

  const currentBadgesURI = await badges.baseTokenURI();
  console.log("  Current baseTokenURI:", currentBadgesURI);

  if (currentBadgesURI === BASE_URI) {
    console.log("  ✓ Already set to the correct URI! No update needed.");
    console.log();
    console.log("If NFTs still don't show on Arbiscan, try:");
    console.log("  1. Wait 24h for Arbiscan to re-index metadata");
    console.log("  2. Visit the NFT page and click 'Refresh Metadata' if available");
    console.log("  3. Verify the metadata URL works: " + BASE_URI + "1.json");
    process.exit(0);
  }

  // ── PRE-FLIGHT: Verify deployer is contract owner ──
  const badgesOwner = await badges.owner();
  if (badgesOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error(`  ✗ Deployer ${deployer.address} is NOT the AchievementBadges owner (${badgesOwner})`);
    console.error("  Set PRIVATE_KEY in .env to the contract owner's key.");
    process.exit(1);
  }
  console.log("  ✓ Deployer is contract owner");
  console.log();

  // ── UPDATE AchievementBadges ──
  console.log("Step 1/2: Setting baseTokenURI on AchievementBadges...");
  let tx = await badges.setBaseTokenURI(BASE_URI);
  console.log("  TX submitted:", tx.hash);
  await tx.wait();
  console.log("  ✓ Confirmed");

  // ── UPDATE AchievementManager ──
  console.log("Step 2/2: Setting badgeMetadataBaseURI on AchievementManager...");
  const manager = new ethers.Contract(MANAGER, [
    "function setBadgeMetadataBaseURI(string) external",
    "function badgeMetadataBaseURI() view returns (string)",
  ], deployer);

  tx = await manager.setBadgeMetadataBaseURI(BASE_URI);
  console.log("  TX submitted:", tx.hash);
  await tx.wait();
  console.log("  ✓ Confirmed");
  console.log();

  // ── VERIFY ──
  console.log("Verifying on-chain state...");
  const newBadgesURI = await badges.baseTokenURI();
  const newManagerURI = await manager.badgeMetadataBaseURI();
  console.log("  Badges baseTokenURI:", newBadgesURI);
  console.log("  Manager baseURI:    ", newManagerURI);
  console.log("  Match:", newBadgesURI === newManagerURI && newBadgesURI === BASE_URI ? "YES ✓" : "NO ✗ PROBLEM");
  console.log();

  console.log("═══════════════════════════════════════════════════");
  console.log("  ✓ DONE — baseTokenURI updated on both contracts");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("NEXT STEPS:");
  console.log("  1. Run the diagnostic script to verify the full chain:");
  console.log("     npx hardhat run scripts/check-mainnet-metadata.ts --network arbitrumOne");
  console.log("  2. Wait for Arbiscan to re-index (can take up to 24h)");
  console.log("  3. Check: https://arbiscan.io/nft/0x5b0ee0abc08fa668c6b215ccd9f9a28a77789d2c/115");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
