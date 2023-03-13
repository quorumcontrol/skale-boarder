import "@nomicfoundation/hardhat-toolbox";
import dotenv from 'dotenv'
import { BigNumber, utils } from "ethers";
import 'hardhat-deploy'
import { HardhatUserConfig, HttpNetworkUserConfig } from 'hardhat/types'

dotenv.config()

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  solidity: {
    compilers: [
      { version: '0.5.17' },
      { version: '0.5.3' },
      { version: '0.8.0' },
      { version: '0.8.19' },
    ]
  },
  paths: {
    artifacts: 'artifacts',
    deploy: 'hardhat/deploy',
    deployments: "deployments",
    sources: 'contracts',
    tests: 'tests'
  },
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545"
    },
    hardhat: {
      allowUnlimitedContractSize: true,
      blockGasLimit: 100000000,
      gas: 100000000,
      accounts: [
        // Same as ganache-cli -d
        { balance: '100000000000000000000', privateKey: '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d' },
        { balance: '100000000000000000000', privateKey: '0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1' },
        { balance: '100000000000000000000', privateKey: '0x6370fd033278c143179d81c5526140625662b8daa446c22ee2d73db3707e620c' },
        { balance: '100000000000000000000', privateKey: '0x646f1ce2fdad0e6deeeb5c7e8e5543bdde65e86029e2fd9fc169899c440a7913' },
        { balance: '100000000000000000000', privateKey: '0xadd53f9a7e588d003326d1cbf9e4a43c061aadd9bc938c843a79e7b4fd2ad743' },
        { balance: '100000000000000000000', privateKey: '0x395df67f0c2d2d9fe1ad08d1bc8b6627011959b79c53d7dd6a3536a33ab8a4fd' },
        { balance: '100000000000000000000', privateKey: '0xe485d098507f54e7733a205420dfddbe58db035fa577fc294ebd14db90767a52' },
        { balance: '100000000000000000000', privateKey: '0xa453611d9419d0e56f499079478fd72c37b251a94bfde4d19872c44cf65386e3' },
        { balance: '100000000000000000000', privateKey: '0x829e924fdf021ba3dbbc4225edfece9aca04b929d6e75613329ca6f1d31c0bb4' },
        { balance: '100000000000000000000', privateKey: '0xb0057716d5917badaf911b193b12b910811c1497b5bada8d7711f758981c3773' },
      ]
    },
  },
  typechain: {
    externalArtifacts: ['gnosis-safe-artifacts/!(*build-info*)/**/!(*dbg*).json'],
  },
  external: {
    contracts: [
      {
        artifacts: 'gnosis-safe-artifacts',
      }
    ]
  },
  deterministicDeployment: (_network: string) => {
    return {
      deployer: "0x1aB62e2DDa7a02923A06904413A007f8e257e0D0",
      factory: "0xf461635EbfA16074b07322781fCcaAA43F852a17",
      signedTx: "0xf901188085174876e800830192ba8080b8c66080604052348015600f57600080fd5b5060a88061001e6000396000f3fe6080604052348015600f57600080fd5b5060003660606000807f94bfd9af14ef450884c8a7ddb5734e2e1e14e70a1c84f0801cc5a29e34d26428905060203603602060003760003560203603600034f5915081605a57600080fd5b8160005260003560205260008160406000a26014600cf3fea2646970667358221220575a90b3fd3629fb06acbbed667e4e921c5fd5d07bd5ef77421d3165bcfa875164736f6c634300081200331ba02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222",
      funding: BigNumber.from(278361).mul(100000000000).toString(),
    }
  },
  namedAccounts: {
    deployer: {
      default: 0
    }
  }
}

export default config
