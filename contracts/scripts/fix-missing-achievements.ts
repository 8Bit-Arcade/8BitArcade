import { ethers, upgrades } from "hardhat";

/**
 * Upgrade AchievementBadges + Mint Missing Badges
 *
 * Root cause: _safeMint reverts with ERC721InvalidOwner for smart contract
 * wallets that don't implement onERC721Received. Fixed by switching to _mint.
 *
 * This script:
 * 1. Upgrades AchievementBadges proxy to new implementation (_mint instead of _safeMint)
 * 2. Mints missing badges directly for the owner wallet
 *
 * Usage:
 *   cd contracts
 *   npx hardhat run scripts/fix-missing-achievements.ts --network arbitrumOne
 */

const WALLET = "0x96e0B627454cE3b8C55C6d36b5FCBb13849Dc297";

const MAINNET_BADGES = "0x5b0ee0abc08fA668c6B215CCD9f9A28a77789d2c";

const BADGE_METADATA_BASE_URI = "https://orange-encouraging-perch-476.mypinata.cloud/ipfs/bafybeicq7qgtsrr4yl45a7waqv7wiluy6nuetjnjeddfo2pxwzljsyin7m/metadata/badges/";

const BADGES_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function hasAchievement(address player, uint256 achievementTypeId) view returns (bool)",
  "function playerAchievements(address, uint256) view returns (uint256)",
  "function authorizedMinters(address) view returns (bool)",
  "function setAuthorizedMinter(address minter, bool authorized) external",
  "function mintBadge(address to, uint256 achievementTypeId, string uri) external returns (uint256)",
  "function nextTokenId() view returns (uint256)",
];

// The 3 achievements that need minting (from diagnostic output)
const MISSING_BADGES = [
  { goalId: 5,  achievementTypeId: 5,  name: "First Steps" },
  { goalId: 13, achievementTypeId: 13, name: "Early Adopter" },
  { goalId: 15, achievementTypeId: 15, name: "OG Member" },
];

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log();
  console.log("═══════════════════════════════════════════════════");
  console.log("  Upgrade AchievementBadges + Mint Missing Badges");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Wallet:", WALLET);
  console.log("Deployer:", deployer.address);
  console.log("Badges proxy:", MAINNET_BADGES);
  console.log();

  // ── Step 1: Upgrade proxy to new implementation ──
  console.log("Step 1: Upgrading AchievementBadges proxy (safeMint → mint)...");
  const AchievementBadges = await ethers.getContractFactory("AchievementBadges");
  const upgraded = await upgrades.upgradeProxy(MAINNET_BADGES, AchievementBadges);
  await upgraded.waitForDeployment();

  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implBytes = await ethers.provider.getStorage(MAINNET_BADGES, implSlot);
  const newImpl = "0x" + implBytes.slice(26);
  console.log("  ✓ Upgraded! New implementation:", newImpl);
  console.log();

  // ── Step 2: Ensure deployer is authorized ──
  const badges = new ethers.Contract(MAINNET_BADGES, BADGES_ABI, deployer);
  const isAuthorized = await badges.authorizedMinters(deployer.address);
  if (!isAuthorized) {
    console.log("Step 2: Authorizing deployer as minter...");
    const tx = await badges.setAuthorizedMinter(deployer.address, true);
    await tx.wait();
    console.log("  ✓ Deployer authorized");
  } else {
    console.log("Step 2: Deployer already authorized");
  }
  console.log();

  // ── Step 3: Mint missing badges ──
  console.log("Step 3: Minting missing badges...");
  for (const badge of MISSING_BADGES) {
    const hasIt = await badges.hasAchievement(WALLET, badge.achievementTypeId);
    if (hasIt) {
      console.log(`  ✓ ${badge.name} (type ${badge.achievementTypeId}): already has badge, skipping`);
      continue;
    }

    const badgeURI = `${BADGE_METADATA_BASE_URI}${badge.achievementTypeId}.json`;
    console.log(`  Minting ${badge.name} (type ${badge.achievementTypeId})...`);
    try {
      const tx = await badges.mintBadge(WALLET, badge.achievementTypeId, badgeURI);
      const receipt = await tx.wait();
      console.log(`  ✓ TX: ${receipt!.hash}`);
    } catch (err: any) {
      console.error(`  ✗ Failed: ${err.reason || err.message}`);
      if (err.data) console.error(`    Error data: ${err.data}`);
    }
  }
  console.log();

  // ── Verify ──
  const finalBalance = await badges.balanceOf(WALLET);
  const nextToken = await badges.nextTokenId();
  console.log("═══════════════════════════════════════════════════");
  console.log("  COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  NFT badge balance: ${finalBalance.toString()}`);
  console.log(`  Next token ID: ${nextToken.toString()}`);
  for (const badge of MISSING_BADGES) {
    const has = await badges.hasAchievement(WALLET, badge.achievementTypeId);
    const tokenId = await badges.playerAchievements(WALLET, badge.achievementTypeId);
    console.log(`  ${badge.name}: ${has ? `✓ tokenId=${tokenId}` : '✗ MISSING'}`);
  }
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
