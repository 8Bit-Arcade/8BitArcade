import { ethers } from "hardhat";
import { formatEther } from "ethers";

/**
 * Check token balances for all deployed contracts
 */
async function main() {
  const TOKEN_ADDRESS = "0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d";
  const TOURNAMENT_MANAGER = "0xe06C92f15F426b0f6Fccb66302790E533C5Dfbb7";
  const TOKEN_SALE = "0x057B1130dD6E8FcBc144bb34172e45293C6839fE";
  const TESTNET_FAUCET = "0x25A4109083f882FCFbC9Ea7cE5Cd942dbae38952";
  const DEPLOYER = "0x92f5523c2329eE281E7FEB8808FcE4b49ab1ebf8";

  const token = await ethers.getContractAt("EightBitToken", TOKEN_ADDRESS);

  console.log("═══════════════════════════════════════════════════");
  console.log("  8BIT TOKEN BALANCE CHECK");
  console.log("═══════════════════════════════════════════════════");
  console.log();

  // Check deployer balance
  const deployerBalance = await token.balanceOf(DEPLOYER);
  console.log("Deployer:", DEPLOYER);
  console.log("Balance:", formatEther(deployerBalance), "8BIT");
  console.log();

  // Check TournamentManager balance
  const tournamentBalance = await token.balanceOf(TOURNAMENT_MANAGER);
  console.log("TournamentManager:", TOURNAMENT_MANAGER);
  console.log("Balance:", formatEther(tournamentBalance), "8BIT");
  console.log("Expected: 20,000,000 8BIT");
  console.log(tournamentBalance >= ethers.parseEther("20000000") ? "✅ FUNDED" : "❌ NOT FUNDED");
  console.log();

  // Check TokenSale balance
  const saleBalance = await token.balanceOf(TOKEN_SALE);
  console.log("TokenSale:", TOKEN_SALE);
  console.log("Balance:", formatEther(saleBalance), "8BIT");
  console.log("Expected: 200,000,000 8BIT");
  console.log(saleBalance >= ethers.parseEther("200000000") ? "✅ FUNDED" : "❌ NOT FUNDED");
  console.log();

  // Check TestnetFaucet balance
  const faucetBalance = await token.balanceOf(TESTNET_FAUCET);
  console.log("TestnetFaucet:", TESTNET_FAUCET);
  console.log("Balance:", formatEther(faucetBalance), "8BIT");
  console.log("Expected: 50,000,000 8BIT");
  console.log(faucetBalance >= ethers.parseEther("50000000") ? "✅ FUNDED" : "❌ NOT FUNDED");
  console.log();

  // Total Supply Check
  const totalSupply = await token.totalSupply();
  console.log("═══════════════════════════════════════════════════");
  console.log("Total Supply:", formatEther(totalSupply), "8BIT");
  console.log("Max Supply: 500,000,000 8BIT");
  console.log("═══════════════════════════════════════════════════");
  console.log();

  // Summary
  const allFunded =
    tournamentBalance >= ethers.parseEther("20000000") &&
    saleBalance >= ethers.parseEther("200000000") &&
    faucetBalance >= ethers.parseEther("50000000");

  if (allFunded) {
    console.log("✅ ALL CONTRACTS PROPERLY FUNDED!");
  } else {
    console.log("❌ SOME CONTRACTS MISSING TOKENS - NEED TO FUND MANUALLY");
    console.log();
    console.log("To fund missing contracts, run:");
    console.log("npx hardhat console --network arbitrumSepolia");
    console.log();
    console.log("Then paste the appropriate commands:");

    if (tournamentBalance < ethers.parseEther("20000000")) {
      console.log("\n// Fund TournamentManager:");
      console.log("const token = await ethers.getContractAt('EightBitToken', '" + TOKEN_ADDRESS + "');");
      console.log("await (await token.transfer('" + TOURNAMENT_MANAGER + "', ethers.parseEther('20000000'))).wait();");
    }

    if (saleBalance < ethers.parseEther("200000000")) {
      console.log("\n// Fund TokenSale:");
      console.log("const token = await ethers.getContractAt('EightBitToken', '" + TOKEN_ADDRESS + "');");
      console.log("await (await token.transfer('" + TOKEN_SALE + "', ethers.parseEther('200000000'))).wait();");
    }

    if (faucetBalance < ethers.parseEther("50000000")) {
      console.log("\n// Fund TestnetFaucet:");
      console.log("const token = await ethers.getContractAt('EightBitToken', '" + TOKEN_ADDRESS + "');");
      console.log("await (await token.transfer('" + TESTNET_FAUCET + "', ethers.parseEther('50000000'))).wait();");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
