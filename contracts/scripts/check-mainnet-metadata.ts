import { ethers } from "hardhat";

/**
 * Comprehensive NFT metadata diagnostic for mainnet AchievementBadges
 *
 * Checks the full metadata chain:
 *   1. On-chain baseTokenURI
 *   2. tokenURI(tokenId) construction
 *   3. HTTP accessibility of metadata JSON
 *   4. Image URL inside metadata JSON
 *   5. HTTP accessibility of image
 *
 * RUN:
 *   cd contracts
 *   npx hardhat run scripts/check-mainnet-metadata.ts --network arbitrumOne
 */

const BADGES = "0x5b0ee0abc08fA668c6B215CCD9f9A28a77789d2c";
const MANAGER = "0xF9f1067873bCe779D35e8796bfE9A32EFf5DAF1f";

// The CORRECT working CID (for comparison)
const EXPECTED_CID = "bafybeicq2vgfk3uk3jq7hw5kxkxjvp25xf6qicpnaxc3hdhqlnd5nwwipm";
const EXPECTED_BASE_URI = `https://orange-encouraging-perch-476.mypinata.cloud/ipfs/${EXPECTED_CID}/badges/`;

// The BROKEN CID (returns 403)
const BROKEN_CID = "bafybeicq7qgtsrr4yl45a7waqv7wiluy6nuetjnjeddfo2pxwzljsyin7m";

const BADGES_ABI = [
  "function baseTokenURI() view returns (string)",
  "function tokenURI(uint256) view returns (string)",
  "function tokenAchievementType(uint256) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
  "function nextTokenId() view returns (uint256)",
  "function owner() view returns (address)",
];

const MANAGER_ABI = [
  "function badgeMetadataBaseURI() view returns (string)",
  "function owner() view returns (address)",
];

async function main() {
  const badges = new ethers.Contract(BADGES, BADGES_ABI, ethers.provider);
  const manager = new ethers.Contract(MANAGER, MANAGER_ABI, ethers.provider);

  let issues = 0;

  console.log();
  console.log("═══════════════════════════════════════════════════");
  console.log("  NFT METADATA DIAGNOSTIC — MAINNET");
  console.log("═══════════════════════════════════════════════════");
  console.log();

  // ── 1. CHECK ON-CHAIN STATE ──
  console.log("── 1. ON-CHAIN STATE ──");
  console.log();

  const baseURI = await badges.baseTokenURI();
  const managerURI = await manager.badgeMetadataBaseURI();
  const badgesOwner = await badges.owner();
  const managerOwner = await manager.owner();
  const nextTokenId = await badges.nextTokenId();

  console.log("AchievementBadges:");
  console.log("  Address:", BADGES);
  console.log("  Owner:", badgesOwner);
  console.log("  baseTokenURI:", baseURI);
  console.log("  nextTokenId:", nextTokenId.toString(), `(${Number(nextTokenId) - 1} tokens minted)`);

  if (baseURI.includes(BROKEN_CID)) {
    console.log("  ✗ PROBLEM: baseTokenURI uses the BROKEN CID (returns 403)!");
    console.log("    Run: npx hardhat run scripts/update-base-uri-mainnet.ts --network arbitrumOne");
    issues++;
  } else if (baseURI === EXPECTED_BASE_URI) {
    console.log("  ✓ baseTokenURI uses the correct working CID");
  } else {
    console.log("  ⚠ baseTokenURI uses an unknown CID — verify manually");
    issues++;
  }
  console.log();

  console.log("AchievementManager:");
  console.log("  Address:", MANAGER);
  console.log("  Owner:", managerOwner);
  console.log("  badgeMetadataBaseURI:", managerURI);

  if (managerURI.includes(BROKEN_CID)) {
    console.log("  ✗ PROBLEM: badgeMetadataBaseURI uses the BROKEN CID!");
    issues++;
  } else if (managerURI === EXPECTED_BASE_URI) {
    console.log("  ✓ badgeMetadataBaseURI uses the correct working CID");
  } else {
    console.log("  ⚠ badgeMetadataBaseURI uses an unknown CID — verify manually");
    issues++;
  }

  if (baseURI !== managerURI) {
    console.log("  ✗ MISMATCH: Badges and Manager have different base URIs!");
    issues++;
  } else {
    console.log("  ✓ Badges and Manager base URIs match");
  }
  console.log();

  // ── 2. CHECK SPECIFIC TOKENS ──
  console.log("── 2. TOKEN URI CHECKS ──");
  console.log();

  const tokenIdsToCheck = [1, 50, 100, 115, 116];

  for (const tokenId of tokenIdsToCheck) {
    try {
      const owner = await badges.ownerOf(tokenId);
      const typeId = await badges.tokenAchievementType(tokenId);
      const uri = await badges.tokenURI(tokenId);

      console.log(`Token #${tokenId}:`);
      console.log(`  Owner: ${owner}`);
      console.log(`  Achievement Type: ${typeId.toString()}`);
      console.log(`  tokenURI: ${uri}`);

      // Fetch metadata JSON
      try {
        const res = await fetch(uri, { signal: AbortSignal.timeout(15000) });
        console.log(`  Metadata HTTP: ${res.status} ${res.statusText}`);

        if (res.ok) {
          const json = await res.json();
          console.log(`  Name: ${json.name}`);
          console.log(`  Image URL: ${json.image}`);

          // Check image accessibility
          if (json.image) {
            try {
              const imgRes = await fetch(json.image, { method: "HEAD", signal: AbortSignal.timeout(15000) });
              console.log(`  Image HTTP: ${imgRes.status} ${imgRes.statusText}`);
              if (imgRes.ok) {
                console.log(`  ✓ Full chain OK — metadata + image accessible`);
              } else {
                console.log(`  ✗ Image NOT accessible (HTTP ${imgRes.status})`);
                issues++;
              }
            } catch (e: any) {
              console.log(`  ✗ Image fetch error: ${e.message}`);
              issues++;
            }
          }
        } else {
          console.log(`  ✗ Metadata NOT accessible (HTTP ${res.status})`);
          issues++;
        }
      } catch (e: any) {
        console.log(`  ✗ Metadata fetch error: ${e.message}`);
        issues++;
      }
      console.log();
    } catch {
      console.log(`Token #${tokenId}: does not exist (not minted yet)`);
      console.log();
    }
  }

  // ── 3. SUMMARY ──
  console.log("═══════════════════════════════════════════════════");
  if (issues === 0) {
    console.log("  ✓ ALL CHECKS PASSED — metadata chain is healthy");
  } else {
    console.log(`  ✗ ${issues} ISSUE(S) FOUND`);
    console.log();
    if (baseURI.includes(BROKEN_CID)) {
      console.log("  FIX: Run the update script to fix baseTokenURI:");
      console.log("    npx hardhat run scripts/update-base-uri-mainnet.ts --network arbitrumOne");
    }
    console.log();
    console.log("  After fixing, wait for Arbiscan to re-index (up to 24h).");
    console.log("  Check: https://arbiscan.io/nft/0x5b0ee0abc08fa668c6b215ccd9f9a28a77789d2c/115");
  }
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => { console.error(error); process.exit(1); });
