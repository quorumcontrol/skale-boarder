import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  solidity: "0.8.17",
  external: {
    contracts: [
      {
        artifacts: ["@skaleboarder/safe-tools/artifacts"]
      }
    ],
    deployments: {
      hardhat: ["@skaleboarder/safe-tools/dist/hardhat/deploy"],
      localhost: ["@skaleboarder/safe-tools/dist/hardhat/deploy"],
    }
  }
};

export default config;
