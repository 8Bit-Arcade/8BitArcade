import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * ⚠️ IMPORTANT: UPDATE THESE VALUES BEFORE DEPLOYMENT ⚠️
 *
 * You MUST create a .env file in the contracts/ directory with:
 * - PRIVATE_KEY: Your deployer wallet private key (KEEP THIS SECRET!)
 * - ETHERSCAN_API_KEY: Your Etherscan API key (works for all chains via API V2)
 *
 * Example .env file:
 * PRIVATE_KEY=0x1234...your...private...key
 * ETHERSCAN_API_KEY=ABC123...your...etherscan...api...key
 *
 * Get your API key at: https://etherscan.io/myapikey
 * (One key works for Arbitrum, Optimism, Polygon, and 60+ chains)
 */

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Arbitrum Sepolia Testnet
    arbitrumSepolia: {
      url: process.env.ARBITRUM_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      timeout: 60000,
    },
    // Arbitrum One Mainnet
    arbitrumOne: {
      url: "https://arb1.arbitrum.io/rpc",
      chainId: 42161,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  sourcify: {
    enabled: false,
  },
};

export default config;
