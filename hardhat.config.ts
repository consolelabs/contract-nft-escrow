import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

import * as dotenv from "dotenv";
dotenv.config();

const config: HardhatUserConfig = {
  solidity: "0.8.17",
  networks: {
    goerli: {
      url: "https://goerli.infura.io/v3/00a46a4fb2a1486e9c1b4534a265a47c",
      accounts: [process.env.GOERLI_PRIVATE_KEY ?? ""],
    },
    ftm: {
      url: "https://rpc.ftm.tools",
      accounts: [process.env.FTM_PRIVATE_KEY ?? ""],
    },
  },
  etherscan: {
    apiKey: {
      goerli: process.env.ETHERSCAN_API_KEY ?? "",
      opera: process.env.FTMSCAN_API_KEY ?? "",
    },
  },
};

export default config;
