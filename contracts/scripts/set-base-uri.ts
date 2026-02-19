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

const MANAGER = "0xcD7b55b846b5FC306ab1B4D2f30FBd3073315e84";
const BADGES = "0xf70C7814C44D9f93Ab35c77a73f584e114783314";

// UPDATE THIS with your Pinata JSON folder CID after re-uploading fixed metadata
const BASE_URI = "ipfs://bafybeiawba4ueh5zpnfbzfpb2nzlk5nwgt7vou37ushiyrgsvszu6yjzha/";

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
