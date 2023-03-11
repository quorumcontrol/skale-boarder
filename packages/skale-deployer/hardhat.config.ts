import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy"

const config: HardhatUserConfig = {
  solidity: "0.8.18",
  networks: {
    hardhat: {
      forking: {
        url: "https://mainnet.skalenodes.com/v1/haunting-devoted-deneb",
      },
      // accounts: [{
      //   privateKey: process.env.DELPHS_PRIVATE_KEY!,
      //   balance: utils.parseEther("100").toString()
      // }]
    },
    skale: {
      url: "https://mainnet.skalenodes.com/v1/haunting-devoted-deneb",
      accounts: [process.env.DELPHS_PRIVATE_KEY].filter(
        (k) => !!k
      ) as string[],
      tags: ["mainnet"],
    },
  },
};

export default config;
