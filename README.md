# SKALE Boarder

Super simple identity and user-onboarding for the SKALE network (but would work well on any cheap/free gas chain).

Warning: this repo is in active development and should not yet be used for critical applications.

## TLDR;

Implement a non-custodial sign-in system that allows in-browser transaction relay without requiring users to switch their wallets.

## Why?

Many dapps want to keep their operations on SKALE, but still allow easy onboarding from users on other EVM chains.

Network switching is still prohibited on some wallets (like Rainbow), and still difficult on many wallets (especially Metamask on mobile).

There are also many usecases where a dapp does not want or need a user to sign every single transaction due to more limited security use cases (such as in-game transactions).

## High level process

* connect a wallet, sign a message authorizing this "device" to relay transactions
* create an in-browser EOA wallet
* deploy a gnosis safe owned by original signer and the inbrowser wallet
* fund the inbrowser wallet (this repo provides a hook for a custom faucet)

Now the site can relay transactions through the gnosis safe using the in-browser wallet.

## Repo Layout

In the `packages` directory you'll find example code (contracts and a UI) along with the libraries.

There are hooks for:
* WAGMI
* rainbowkit

These make using the safe-tools library in those environments seamless and can wrap other wallets.

## Get started fast:


Install the safe tools to your contract repo
`
  npm install @skaleboarder/safe-tools
`

Add the following to your hardhat config (that's using hardhat-deploy):

```typescript
  {
  //...
  external: {
    contracts: [{
      artifacts: ["node_modules/@skaleboarder/safe-tools/artifacts", "../../node_modules/@skaleboarder/safe-tools/gnosis-safe-artifacts"],
      deploy: "node_modules/@skaleboarder/safe-tools/hardhat/deploy",
    }],
  },
  deterministicDeployment: (_network: string) => {
    return {
      deployer: "0x1aB62e2DDa7a02923A06904413A007f8e257e0D0",
      factory: "0xf461635EbfA16074b07322781fCcaAA43F852a17",
      signedTx: "0xf901188085174876e800830192ba8080b8c66080604052348015600f57600080fd5b5060a88061001e6000396000f3fe6080604052348015600f57600080fd5b5060003660606000807f94bfd9af14ef450884c8a7ddb5734e2e1e14e70a1c84f0801cc5a29e34d26428905060203603602060003760003560203603600034f5915081605a57600080fd5b8160005260003560205260008160406000a26014600cf3fea2646970667358221220575a90b3fd3629fb06acbbed667e4e921c5fd5d07bd5ef77421d3165bcfa875164736f6c634300081200331ba02222222222222222222222222222222222222222222222222222222222222222a02222222222222222222222222222222222222222222222222222222222222222",
      funding: BigNumber.from(278361).mul(100000000000).toString(),
    }
  },
  //...
  }
```
