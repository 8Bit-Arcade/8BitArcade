import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

/**
 * ⚠️ IMPORTANT: UPDATE THESE VALUES BEFORE DEPLOYMENT ⚠️
 *
 * You MUST create a .env file in the contracts/ directory with:
 * - PRIVATE_KEY: Your deployer wallet private key (KEEP THIS SECRET!)
 * - ARBISCAN_API_KEY: Your Arbiscan API key for contract verification
 *
 * Example .env file:
 * PRIVATE_KEY=0x1234...your...private...key
 * ARBISCAN_API_KEY=ABC123...your...arbiscan...api...key
 */

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
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
    apiKey: process.env.ARBISCAN_API_KEY || "",
    customChains: [
      {
        network: "arbitrumSepolia",
        chainId: 421614,
        urls: {
          apiURL: "https://api-sepolia.arbiscan.io/api",
          browserURL: "https://sepolia.arbiscan.io",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
};

export default config;
