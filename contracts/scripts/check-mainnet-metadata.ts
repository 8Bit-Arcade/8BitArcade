import { ethers } from "hardhat";

/**
 * Verify NFT metadata chain on mainnet for a specific token
 */

const BADGES = "0x5b0ee0abc08fA668c6B215CCD9f9A28a77789d2c";

const BADGES_ABI = [
  "function baseTokenURI() view returns (string)",
  "function tokenURI(uint256) view returns (string)",
  "function tokenAchievementType(uint256) view returns (uint256)",
  "function ownerOf(uint256) view returns (address)",
];

async function main() {
  const badges = new ethers.Contract(BADGES, BADGES_ABI, ethers.provider);

  console.log("=== MAINNET NFT METADATA CHECK ===\n");

  // 1. Check baseTokenURI
  const baseURI = await badges.baseTokenURI();
  console.log("baseTokenURI:", baseURI);
  console.log();

  // 2. Check token 116
  const tokenId = 116;
  console.log(`--- Token #${tokenId} ---`);
  const owner = await badges.ownerOf(tokenId);
  const typeId = await badges.tokenAchievementType(tokenId);
  const uri = await badges.tokenURI(tokenId);

  console.log("owner:", owner);
  console.log("achievementTypeId:", typeId.toString());
  console.log("tokenURI:", uri);
  console.log();

  // 3. Fetch the JSON
  console.log("Fetching metadata JSON...");
  try {
    const res = await fetch(uri, { signal: AbortSignal.timeout(15000) });
    console.log("HTTP status:", res.status, res.statusText);
    if (res.ok) {
      const json = await res.json();
      console.log("name:", json.name);
      console.log("description:", json.description);
      console.log("image URL:", json.image);
      console.log();

      // 4. Check if image is accessible
      console.log("Checking image...");
      const imgRes = await fetch(json.image, { method: "HEAD", signal: AbortSignal.timeout(15000) });
      console.log("Image HTTP status:", imgRes.status, imgRes.statusText);
      console.log("Content-Type:", imgRes.headers.get("content-type"));
      console.log("Content-Length:", imgRes.headers.get("content-length"));
    } else {
      console.log("METADATA FETCH FAILED");
      console.log("Response:", await res.text());
    }
  } catch (e: any) {
    console.log("Fetch error:", e.message);
  }

  // 5. Also check a few other tokens
  console.log("\n--- Quick check other tokens ---");
  for (const id of [1, 50, 100]) {
    try {
      const u = await badges.tokenURI(id);
      console.log(`Token ${id}: ${u}`);
    } catch {
      console.log(`Token ${id}: does not exist`);
    }
  }

  console.log("\n=== DONE ===");
}

main()
  .then(() => process.exit(0))
  .catch((error) => { console.error(error); process.exit(1); });
