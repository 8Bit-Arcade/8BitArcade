import { ethers } from "hardhat";

/**
 * Fix Missing Mainnet NFT Badges — Diagnostic + Fix
 *
 * Deeply diagnoses why mintBadge reverts, then fixes the issue.
 *
 * Usage:
 *   cd contracts
 *   npx hardhat run scripts/fix-missing-achievements.ts --network arbitrumOne
 */

const WALLET = "0x96e0B627454cE3b8C55C6d36b5FCBb13849Dc297";

const TESTNET_MANAGER = "0xE68d3AdD44C541fF76C85D185d02BE5ceAC833B3";
const TESTNET_RPC = "https://sepolia-rollup.arbitrum.io/rpc";

const MAINNET_MANAGER = "0xF9f1067873bCe779D35e8796bfE9A32EFf5DAF1f";
const MAINNET_BADGES = "0x5b0ee0abc08fA668c6B215CCD9f9A28a77789d2c";

const BADGE_METADATA_BASE_URI = "https://orange-encouraging-perch-476.mypinata.cloud/ipfs/bafybeicq7qgtsrr4yl45a7waqv7wiluy6nuetjnjeddfo2pxwzljsyin7m/metadata/badges/";

const MANAGER_ABI = [
  "function getPlayerGoalStatuses(address player, uint256[] goalIds) view returns (bool[])",
  "function getPlayerAchievementCount(address player) view returns (uint256)",
  "function awardAchievement(address player, uint256 goalId) external",
  "function resetPlayerGoalCompletions(address[] players, uint256[] goalIds) external",
  "function achievementBadges() view returns (address)",
  "function eightBitToken() view returns (address)",
  "function badgeMetadataBaseURI() view returns (string)",
  "function goals(uint256) view returns (uint256 id, string name, string description, uint8 category, uint256 threshold, string gameId, uint256 achievementTypeId, uint256 rewardItemTypeId, uint256 rewardTokenAmount, bool active)",
  "function nextGoalId() view returns (uint256)",
];

const BADGES_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function hasAchievement(address player, uint256 achievementTypeId) view returns (bool)",
  "function playerAchievements(address, uint256) view returns (uint256)",
  "function authorizedMinters(address) view returns (bool)",
  "function setAuthorizedMinter(address minter, bool authorized) external",
  "function mintBadge(address to, uint256 achievementTypeId, string uri) external returns (uint256)",
  "function owner() view returns (address)",
  "function nextTokenId() view returns (uint256)",
];

const GOAL_NAMES: Record<number, string> = {
  1: "Space Rocks Master", 2: "Galaxy Ace", 3: "Tetris God", 4: "Shutout King",
  5: "First Steps", 6: "8-Bit Legend", 7: "Tournament Champion",
  8: "Week Warrior", 9: "Century Club",
  10: "8Bit Gamer", 11: "8Bit Prodigy", 12: "8Bit God",
  13: "Early Adopter", 14: "Game Explorer", 15: "OG Member",
  16: "Lucky 777", 17: "Night Owl", 18: "Palindrome Master",
  19: "Double Trouble", 20: "The Answer",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log();
  console.log("═══════════════════════════════════════════════════");
  console.log("  DEEP DIAGNOSTIC — Mainnet NFT Badge Minting");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Wallet:", WALLET);
  console.log("Deployer:", deployer.address);
  console.log();

  const mainnetManager = new ethers.Contract(MAINNET_MANAGER, MANAGER_ABI, deployer);
  const mainnetBadges = new ethers.Contract(MAINNET_BADGES, BADGES_ABI, deployer);

  // ═══════════════════════════════════════════════════════════
  // DIAGNOSTIC 1: Contract linkage
  // ═══════════════════════════════════════════════════════════
  console.log("── DIAGNOSTIC 1: Contract Linkage ──");
  const linkedBadges = await mainnetManager.achievementBadges();
  const linkedToken = await mainnetManager.eightBitToken();
  const managerBaseURI = await mainnetManager.badgeMetadataBaseURI();
  const nextGoalId = await mainnetManager.nextGoalId();
  console.log(`  Manager.achievementBadges(): ${linkedBadges}`);
  console.log(`  Expected AchievementBadges:  ${MAINNET_BADGES}`);
  console.log(`  Match: ${linkedBadges.toLowerCase() === MAINNET_BADGES.toLowerCase()}`);
  console.log(`  Manager.eightBitToken(): ${linkedToken}`);
  console.log(`  Manager.badgeMetadataBaseURI(): ${managerBaseURI}`);
  console.log(`  Manager.nextGoalId(): ${nextGoalId.toString()}`);
  console.log();

  // ═══════════════════════════════════════════════════════════
  // DIAGNOSTIC 2: Goals on mainnet
  // ═══════════════════════════════════════════════════════════
  console.log("── DIAGNOSTIC 2: Goal Configuration on Mainnet ──");
  for (const goalId of [5, 13, 15]) {
    try {
      const goal = await mainnetManager.goals(goalId);
      console.log(`  Goal ${goalId}: name="${goal.name}", achievementTypeId=${goal.achievementTypeId}, active=${goal.active}, rewardTokens=${ethers.formatEther(goal.rewardTokenAmount)} 8BIT`);
    } catch (err: any) {
      console.log(`  Goal ${goalId}: ERROR reading — ${err.message}`);
    }
  }
  console.log();

  // ═══════════════════════════════════════════════════════════
  // DIAGNOSTIC 3: Authorization
  // ═══════════════════════════════════════════════════════════
  console.log("── DIAGNOSTIC 3: Authorization ──");
  const badgesOwner = await mainnetBadges.owner();
  const managerAuth = await mainnetBadges.authorizedMinters(MAINNET_MANAGER);
  const deployerAuth = await mainnetBadges.authorizedMinters(deployer.address);
  console.log(`  Badges owner: ${badgesOwner}`);
  console.log(`  Manager authorized: ${managerAuth}`);
  console.log(`  Deployer authorized: ${deployerAuth}`);

  // Ensure deployer is authorized
  if (!deployerAuth) {
    console.log(`  Authorizing deployer...`);
    const tx = await mainnetBadges.setAuthorizedMinter(deployer.address, true);
    await tx.wait();
    console.log(`  ✓ Done`);
  }
  console.log();

  // ═══════════════════════════════════════════════════════════
  // DIAGNOSTIC 4: Badge state for this wallet
  // ═══════════════════════════════════════════════════════════
  console.log("── DIAGNOSTIC 4: Badge State for Wallet ──");
  const badgeBalance = await mainnetBadges.balanceOf(WALLET);
  const nextTokenIdBadges = await mainnetBadges.nextTokenId();
  console.log(`  balanceOf(wallet): ${badgeBalance.toString()}`);
  console.log(`  nextTokenId: ${nextTokenIdBadges.toString()}`);

  for (const achievementTypeId of [5, 13, 15]) {
    const tokenId = await mainnetBadges.playerAchievements(WALLET, achievementTypeId);
    const hasIt = await mainnetBadges.hasAchievement(WALLET, achievementTypeId);
    console.log(`  playerAchievements(wallet, ${achievementTypeId}): tokenId=${tokenId.toString()}, hasAchievement=${hasIt}`);
  }
  console.log();

  // ═══════════════════════════════════════════════════════════
  // DIAGNOSTIC 5: Goal completion state on AchievementManager
  // ═══════════════════════════════════════════════════════════
  console.log("── DIAGNOSTIC 5: AchievementManager Goal Completion ──");
  const goalIds = Array.from({ length: 20 }, (_, i) => i + 1);
  const statuses: boolean[] = await mainnetManager.getPlayerGoalStatuses(WALLET, goalIds);
  for (let i = 0; i < statuses.length; i++) {
    if (statuses[i]) {
      console.log(`  Goal ${goalIds[i]} (${GOAL_NAMES[goalIds[i]]}): COMPLETED`);
    }
  }
  const completedCount = statuses.filter(s => s).length;
  console.log(`  Total completed: ${completedCount}`);
  console.log();

  // ═══════════════════════════════════════════════════════════
  // DIAGNOSTIC 6: Try mintBadge with staticCall for revert reason
  // ═══════════════════════════════════════════════════════════
  console.log("── DIAGNOSTIC 6: mintBadge staticCall (revert reason) ──");
  for (const achievementTypeId of [5, 13, 15]) {
    const badgeURI = `${BADGE_METADATA_BASE_URI}${achievementTypeId}.json`;
    try {
      const result = await mainnetBadges.mintBadge.staticCall(WALLET, achievementTypeId, badgeURI);
      console.log(`  mintBadge(wallet, ${achievementTypeId}): would succeed, tokenId=${result.toString()}`);
    } catch (err: any) {
      // Try to extract revert reason
      const reason = err.reason || err.message || String(err);
      console.log(`  mintBadge(wallet, ${achievementTypeId}): REVERTS — ${reason}`);

      // Also try raw error data decoding
      if (err.data) {
        console.log(`  Raw error data: ${err.data}`);
      }
    }
  }
  console.log();

  // ═══════════════════════════════════════════════════════════
  // DIAGNOSTIC 7: Try raw low-level call to badges (simulate what Manager does)
  // ═══════════════════════════════════════════════════════════
  console.log("── DIAGNOSTIC 7: Simulating Manager's low-level call ──");
  const iface = new ethers.Interface(BADGES_ABI);
  for (const achievementTypeId of [5]) {
    const badgeURI = `${BADGE_METADATA_BASE_URI}${achievementTypeId}.json`;
    const calldata = iface.encodeFunctionData("mintBadge", [WALLET, achievementTypeId, badgeURI]);
    console.log(`  Calldata for mintBadge(wallet, ${achievementTypeId}): ${calldata.slice(0, 74)}...`);

    try {
      const result = await deployer.call({
        to: MAINNET_BADGES,
        data: calldata,
      });
      console.log(`  Raw call result: ${result}`);
    } catch (err: any) {
      console.log(`  Raw call reverts: ${err.reason || err.message}`);
      if (err.data) console.log(`  Error data: ${err.data}`);
    }
  }
  console.log();

  // ═══════════════════════════════════════════════════════════
  // DIAGNOSTIC 8: Check if badges contract is a proxy pointing to valid impl
  // ═══════════════════════════════════════════════════════════
  console.log("── DIAGNOSTIC 8: Proxy Implementation Check ──");
  // ERC-1967 implementation slot: keccak256("eip1967.proxy.implementation") - 1
  const implSlot = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
  const implBytes = await ethers.provider.getStorage(MAINNET_BADGES, implSlot);
  const implAddress = "0x" + implBytes.slice(26); // last 20 bytes
  console.log(`  Badges proxy implementation: ${implAddress}`);

  const implCode = await ethers.provider.getCode(implAddress);
  console.log(`  Implementation has code: ${implCode.length > 2}`);
  console.log(`  Implementation code size: ${(implCode.length - 2) / 2} bytes`);
  console.log();

  // Same for manager
  const managerImplBytes = await ethers.provider.getStorage(MAINNET_MANAGER, implSlot);
  const managerImplAddress = "0x" + managerImplBytes.slice(26);
  console.log(`  Manager proxy implementation: ${managerImplAddress}`);
  const managerImplCode = await ethers.provider.getCode(managerImplAddress);
  console.log(`  Implementation has code: ${managerImplCode.length > 2}`);
  console.log(`  Implementation code size: ${(managerImplCode.length - 2) / 2} bytes`);
  console.log();

  console.log("═══════════════════════════════════════════════════");
  console.log("  DIAGNOSTIC COMPLETE — review output above");
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
