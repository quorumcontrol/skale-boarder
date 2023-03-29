# safe-tools

[![npm version](https://badge.fury.io/js/@skaleboarder%2Fsafe-tools.svg)](https://badge.fury.io/js/@skaleboarder%2Fsafe-tools)

The SafeRelayer library allows you to implement a non-custodial sign-in system that enables in-browser transaction relay without requiring users to switch their wallets. It uses the Gnosis Safe for transaction processing and provides a seamless integration with your dApp.

## Usage

Import the required modules and classes:

Import necessary modules and classes from the SafeRelayer library, ethers.js, and other required packages.

```typescript
import { SafeRelayer, UserRelayerProps } from '@skaleboarder/safe-tools';
import { ethers } from 'ethers';
```

Create a relayer object:

Create a relayer object with the required configurations, such as signer, ethers, wallet deployer address, EnglishOwnerAdder address, network configuration, provider, and faucet function.

```typescript
  const relayer = new SafeRelayer({
      ethers,
      signer: signers[1],
      walletDeployerAddress: walletDeployer.address,
      EnglishOwnerAdderAddress: deploys.EnglishOwnerAdder.address,
      networkConfig: contractNetworks,
      provider: deployer.provider!,
      faucet: async (address: string) => {
          await (await deployer.sendTransaction({
              to: address,
              value: ethers.utils.parseEther("2")
          })).wait()
      }
  })
  
  // we need to do this within the fixture so that the safe is created before the test runs
  // and when the state is snapshotted it all works.
  await relayer.ready
```

