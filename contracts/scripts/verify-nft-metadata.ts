import { ethers } from "hardhat";

/**
 * Deep-dive verification: checks the entire NFT metadata chain
 *
 * 1. On-chain baseTokenURI on AchievementBadges
 * 2. On-chain badgeMetadataBaseURI on AchievementManager
 * 3. tokenAchievementType mapping for a specific token
 * 4. Computed tokenURI
 * 5. Whether the JSON resolves on IPFS
 * 6. Whether the image inside the JSON resolves
 */

const BADGES = "0x8dE45E3e37f0721D64d63E32da5f37CfaCF9ca9f";
const MANAGER = "0xE68d3AdD44C541fF76C85D185d02BE5ceAC833B3";

const BADGES_ABI = [
  "function baseTokenURI() view returns (string)",
  "function tokenURI(uint256) view returns (string)",
  "function tokenAchievementType(uint256) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
];

const MANAGER_ABI = [
  "function badgeMetadataBaseURI() view returns (string)",
  "function goals(uint256) view returns (uint256 goalId, uint256 achievementTypeId, uint8 goalType, uint256 threshold, uint256 tokenReward, uint256 itemRewardId, uint256 itemRewardAmount, bool active)",
  "function goalCount() view returns (uint256)",
];

async function main() {
  const provider = ethers.provider;
  const badges = new ethers.Contract(BADGES, BADGES_ABI, provider);
  const manager = new ethers.Contract(MANAGER, MANAGER_ABI, provider);

  console.log("=== NFT METADATA DEEP DIVE ===\n");

  // 1. Check base URIs on both contracts
  const badgesBaseURI = await badges.baseTokenURI();
  const managerBaseURI = await manager.badgeMetadataBaseURI();
  console.log("1. BASE URIs:");
  console.log("   Badges  baseTokenURI:        ", badgesBaseURI);
  console.log("   Manager badgeMetadataBaseURI: ", managerBaseURI);
  console.log("   Match:", badgesBaseURI === managerBaseURI ? "YES" : "NO <<<< MISMATCH!");
  console.log();

  // 2. Check total supply
  const totalSupply = await badges.totalSupply();
  console.log("2. TOTAL SUPPLY:", totalSupply.toString());
  console.log();

  // 3. Check goal setup on manager
  const goalCount = await manager.goalCount();
  console.log("3. MANAGER GOALS (", goalCount.toString(), "total ):");
  for (let i = 1; i <= Number(goalCount); i++) {
    try {
      const goal = await manager.goals(i);
      console.log(`   Goal ${i}: achievementTypeId=${goal.achievementTypeId}, active=${goal.active}, threshold=${goal.threshold}`);
    } catch {
      console.log(`   Goal ${i}: ERROR reading`);
    }
  }
  console.log();

  // 4. Check specific tokens
  const tokensToCheck = [1, 73];
  for (const tokenId of tokensToCheck) {
    console.log(`4. TOKEN #${tokenId}:`);
    try {
      const owner = await badges.ownerOf(tokenId);
      const achievementTypeId = await badges.tokenAchievementType(tokenId);
      const tokenURI = await badges.tokenURI(tokenId);

      console.log(`   Owner: ${owner}`);
      console.log(`   achievementTypeId: ${achievementTypeId}`);
      console.log(`   tokenURI: ${tokenURI}`);
      console.log(`   Expected: ${badgesBaseURI}${achievementTypeId}.json`);

      // Try to fetch the JSON
      const ipfsHash = tokenURI.replace("ipfs://", "");
      const gatewayUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
      console.log(`   Gateway URL: ${gatewayUrl}`);

      try {
        const response = await fetch(gatewayUrl, { signal: AbortSignal.timeout(15000) });
        if (response.ok) {
          const json = await response.json();
          console.log(`   JSON fetched OK!`);
          console.log(`   name: ${json.name}`);
          console.log(`   image: ${json.image}`);

          // Check image
          const imageHash = json.image.replace("ipfs://", "");
          const imageUrl = `https://ipfs.io/ipfs/${imageHash}`;
          console.log(`   Image gateway: ${imageUrl}`);
          try {
            const imgResp = await fetch(imageUrl, { method: "HEAD", signal: AbortSignal.timeout(15000) });
            console.log(`   Image status: ${imgResp.status} ${imgResp.statusText}`);
            console.log(`   Image content-type: ${imgResp.headers.get("content-type")}`);
          } catch (e: any) {
            console.log(`   Image fetch FAILED: ${e.message}`);
          }
        } else {
          console.log(`   JSON fetch FAILED: ${response.status} ${response.statusText}`);
        }
      } catch (e: any) {
        console.log(`   JSON fetch FAILED: ${e.message}`);
      }
    } catch (e: any) {
      console.log(`   Token does not exist or error: ${e.message?.slice(0, 100)}`);
    }
    console.log();
  }

  // 5. Expected URI check
  console.log("5. EXPECTED URI PATTERN:");
  console.log("   For achievementTypeId=1:");
  console.log("   tokenURI should be: " + badgesBaseURI + "1.json");
  console.log("   For that to work, this URL must resolve:");
  const testHash = (badgesBaseURI + "1.json").replace("ipfs://", "");
  console.log("   https://ipfs.io/ipfs/" + testHash);
  console.log();

  console.log("=== DONE ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
