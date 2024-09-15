import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomiclabs/hardhat-solhint";
import "@openzeppelin/hardhat-upgrades";
import 'solidity-coverage'
import "hardhat-gas-reporter"

import dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const AMOY_URL = process.env.AMOY_URL;
const SEPOLIA_SCAN = process.env.SEPOLIA_SCAN;

const config: HardhatUserConfig = {
  typechain: {
    outDir: "./typechain",
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    amoy: {
      url: AMOY_URL,
      accounts: [`0x${PRIVATE_KEY}`]
    },
  },
  etherscan: {
    apiKey: SEPOLIA_SCAN,
    customChains: [
      {
        network: "amoy",
        chainId: 80002,
        urls: {
          apiURL: "https://www.oklink.com/api/explorer/v1/contract/verify/async/api/polygonAmoy",
          browserURL: "https://www.oklink.com/polygonAmoy"
        }
      },
      {
        network: "mainnet",
        chainId: 137,
        urls: {
          apiURL: "https://api.polygonscan.com/api",
          browserURL: "https://polygonscan.com/"
        }
      }
    ]
  },
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          optimizer: {
            enabled: true,
            runs: 1000
          }
        }
      }
    ]
  }  
};


export default config;
