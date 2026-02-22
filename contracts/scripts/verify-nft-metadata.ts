import { ethers } from "hardhat";

/**
 * Deep-dive verification: checks the entire NFT metadata chain
 */

const BADGES = "0x8dE45E3e37f0721D64d63E32da5f37CfaCF9ca9f";
const MANAGER = "0xE68d3AdD44C541fF76C85D185d02BE5ceAC833B3";

const BADGES_ABI = [
  "function baseTokenURI() view returns (string)",
  "function tokenURI(uint256) view returns (string)",
  "function tokenAchievementType(uint256) view returns (uint256)",
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

  // 1. Base URIs
  const badgesBaseURI = await badges.baseTokenURI();
  const managerBaseURI = await manager.badgeMetadataBaseURI();
  console.log("1. BASE URIs:");
  console.log("   Badges:  ", badgesBaseURI);
  console.log("   Manager: ", managerBaseURI);
  console.log("   Match:", badgesBaseURI === managerBaseURI ? "YES" : "NO <<<< MISMATCH!");
  console.log();

  // 2. Goal setup - show achievementTypeId for each goal
  try {
    const goalCount = await manager.goalCount();
    console.log("2. GOALS (goalId -> achievementTypeId):");
    for (let i = 1; i <= Math.min(Number(goalCount), 20); i++) {
      try {
        const goal = await manager.goals(i);
        console.log(`   Goal ${i}: achievementTypeId=${goal.achievementTypeId}, active=${goal.active}`);
      } catch { console.log(`   Goal ${i}: error`); }
    }
  } catch (e: any) { console.log("2. Goals: error -", e.message?.slice(0, 80)); }
  console.log();

  // 3. Check tokens 1-100 to find existing ones
  console.log("3. TOKENS:");
  const found: number[] = [];
  for (let id = 1; id <= 100; id++) {
    try {
      await badges.ownerOf(id);
      found.push(id);
    } catch { /* doesn't exist */ }
  }
  console.log(`   Found ${found.length} tokens: ${found.join(", ")}`);
  console.log();

  // 4. Deep check each found token (or first 5 + token 73)
  const toCheck = [...new Set([...found.slice(0, 5), 73])].filter(id => found.includes(id));
  for (const tokenId of toCheck) {
    console.log(`4. TOKEN #${tokenId}:`);
    try {
      const owner = await badges.ownerOf(tokenId);
      const typeId = await badges.tokenAchievementType(tokenId);
      const uri = await badges.tokenURI(tokenId);

      console.log(`   owner: ${owner}`);
      console.log(`   achievementTypeId: ${typeId}`);
      console.log(`   tokenURI: ${uri}`);

      // Fetch JSON
      const hash = uri.replace("ipfs://", "");
      const url = `https://ipfs.io/ipfs/${hash}`;
      console.log(`   gateway: ${url}`);

      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
        if (res.ok) {
          const json = await res.json();
          console.log(`   JSON OK -> name: "${json.name}", image: ${json.image}`);

          // Check image
          const imgHash = json.image.replace("ipfs://", "");
          const imgUrl = `https://ipfs.io/ipfs/${imgHash}`;
          try {
            const imgRes = await fetch(imgUrl, { method: "HEAD", signal: AbortSignal.timeout(20000) });
            console.log(`   Image: ${imgRes.status} ${imgRes.statusText} (${imgRes.headers.get("content-type")})`);
          } catch (e: any) { console.log(`   Image fetch error: ${e.message}`); }
        } else {
          console.log(`   JSON FAILED: ${res.status} ${res.statusText} <<<< PROBLEM`);
        }
      } catch (e: any) { console.log(`   JSON fetch error: ${e.message}`); }
    } catch (e: any) { console.log(`   Error: ${e.message?.slice(0, 100)}`); }
    console.log();
  }

  console.log("=== DONE ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => { console.error(error); process.exit(1); });
