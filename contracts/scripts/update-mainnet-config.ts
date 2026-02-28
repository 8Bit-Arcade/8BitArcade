/**
 * Post-Deployment Config Update Script
 *
 * Run this AFTER deploy-nft-mainnet.ts succeeds.
 * Pass the deployed contract addresses as arguments.
 *
 * Usage:
 *   npx ts-node scripts/update-mainnet-config.ts \
 *     --badges 0xABC... \
 *     --items 0xDEF... \
 *     --manager 0x123...
 *
 * This updates:
 * - frontend/src/config/contracts.ts (MAINNET_CONTRACTS + USE_TESTNET=false)
 * - functions/src/config.ts (mainnet addresses + USE_TESTNET=false)
 */

import * as fs from "fs";
import * as path from "path";

function main() {
  const args = process.argv.slice(2);
  const getArg = (name: string): string => {
    const idx = args.indexOf(`--${name}`);
    if (idx === -1 || idx + 1 >= args.length) {
      console.error(`Missing --${name} argument`);
      process.exit(1);
    }
    return args[idx + 1];
  };

  const badgesAddress = getArg("badges");
  const itemsAddress = getArg("items");
  const managerAddress = getArg("manager");

  console.log("Updating configs with deployed addresses:");
  console.log("  AchievementBadges:", badgesAddress);
  console.log("  TradeableItems:", itemsAddress);
  console.log("  AchievementManager:", managerAddress);
  console.log();

  // 1. Update frontend contracts.ts
  const frontendConfigPath = path.resolve(__dirname, "../../frontend/src/config/contracts.ts");
  if (fs.existsSync(frontendConfigPath)) {
    let content = fs.readFileSync(frontendConfigPath, "utf-8");

    // Update mainnet addresses
    content = content.replace(
      /ACHIEVEMENT_BADGES: '0x0+'/,
      `ACHIEVEMENT_BADGES: '${badgesAddress}'`
    );
    content = content.replace(
      /TRADEABLE_ITEMS: '0x0+'/,
      `TRADEABLE_ITEMS: '${itemsAddress}'`
    );
    content = content.replace(
      /ACHIEVEMENT_MANAGER: '0x0+'/,
      `ACHIEVEMENT_MANAGER: '${managerAddress}'`
    );

    // Switch to mainnet
    content = content.replace(
      /export const USE_TESTNET = true;/,
      "export const USE_TESTNET = false;"
    );

    fs.writeFileSync(frontendConfigPath, content);
    console.log("✓ Updated frontend/src/config/contracts.ts");
  } else {
    console.log("⚠ frontend/src/config/contracts.ts not found");
  }

  // 2. Update functions config.ts
  const functionsConfigPath = path.resolve(__dirname, "../../functions/src/config.ts");
  if (fs.existsSync(functionsConfigPath)) {
    let content = fs.readFileSync(functionsConfigPath, "utf-8");

    // Switch to mainnet
    content = content.replace(
      /export const USE_TESTNET = true;/,
      "export const USE_TESTNET = false;"
    );

    // Update achievement manager address (mainnet line)
    content = content.replace(
      /: '0x0{40}'; \/\/ UPDATE: Deploy to mainnet/,
      `: '${managerAddress}'; // Arbitrum One mainnet`
    );

    fs.writeFileSync(functionsConfigPath, content);
    console.log("✓ Updated functions/src/config.ts");
  } else {
    console.log("⚠ functions/src/config.ts not found");
  }

  console.log();
  console.log("Done! Next steps:");
  console.log("  1. Review the changes: git diff");
  console.log("  2. Rebuild frontend: cd frontend && npm run build");
  console.log("  3. Deploy Firebase functions: cd functions && npm run deploy");
  console.log("  4. Push changes: git add -A && git commit && git push");
}

main();
