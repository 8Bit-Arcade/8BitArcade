import { ethers } from "hardhat";

/**
 * Set badge metadata base URI on both contracts
 *
 * After uploading the fixed JSON metadata folder to Pinata, update BASE_URI
 * below with the new folder CID, then run this script.
 *
 * tokenURI for each badge will resolve to: BASE_URI + achievementTypeId + ".json"
 * e.g. ipfs://<CID>/13.json for Early Adopter (achievementTypeId 13)
 *
 * USAGE:
 *   npx hardhat run scripts/set-base-uri.ts --network arbitrumSepolia
 */

const MANAGER = "0xE68d3AdD44C541fF76C85D185d02BE5ceAC833B3";
const BADGES = "0x8dE45E3e37f0721D64d63E32da5f37CfaCF9ca9f";

// UPDATE THIS with your Pinata JSON folder CID after re-uploading fixed metadata
const BASE_URI = "ipfs://bafybeicekkmn7nz6cktpkrxb7bcbptexs3aft6p43cicmwnyz5yfhh32v4/";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Setting base URI with account:", deployer.address);
  console.log("Base URI:", BASE_URI);
  console.log();

  const manager = new ethers.Contract(MANAGER, [
    "function setBadgeMetadataBaseURI(string) external"
  ], deployer);

  const badges = new ethers.Contract(BADGES, [
    "function setBaseTokenURI(string) external"
  ], deployer);

  console.log("Setting URI on AchievementManager...");
  let tx = await manager.setBadgeMetadataBaseURI(BASE_URI);
  await tx.wait();
  console.log("  Done:", tx.hash);

  console.log("Setting URI on AchievementBadges...");
  tx = await badges.setBaseTokenURI(BASE_URI);
  await tx.wait();
  console.log("  Done:", tx.hash);

  console.log("\nBase URI set on both contracts!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
