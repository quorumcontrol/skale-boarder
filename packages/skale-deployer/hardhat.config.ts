import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-deploy"
import { BigNumber } from "ethers";
import "@tovarishfin/hardhat-yul";

const config: HardhatUserConfig = {
  solidity: "0.8.18",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      // forking: {
      //   url: "https://mainnet.skalenodes.com/v1/haunting-devoted-deneb",
      // },
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
  deterministicDeployment: (_network:string) => {
    return {
      deployer: "0x1aB62e2DDa7a02923A06904413A007f8e257e0D0",
      factory: "0xf461635EbfA16074b07322781fCcaAA43F852a17",
      signedTx: "0xf901188085174876e800830192ba8080b8c66080604052348015600f57600080fd5b5060a88061001e6000396000f3fe6080604052348015600f57600080fd5b5060003660606000807f94bfd9af14ef450884c8a7ddb5734e2e1e14e70a1c84f0801cc5a29e34d26428905060203603602060003760003560203603600034f5915081605a57600080fd5b8160005260003560205260008160406000a26014600cf3fea2646970667358221220575a90b3fd3629fb06acbbed667e4e921c5fd5d07bd5ef77421d3165bcfa875164736f6c634300081200331ba02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222",
      funding: BigNumber.from(278361).mul(100000000000).toString(),
    }
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  }
};

export default config;
