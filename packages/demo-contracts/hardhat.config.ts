import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy";

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  solidity: "0.8.17",
  external: {
    contracts: [{
      artifacts: ["../../node_modules/@skaleboarder/safe-tools/artifacts", "../../node_modules/**"],
      deploy: "../../node_modules/@skaleboarder/safe-tools/hardhat/deploy",
    }],
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  }
};

export default config;
