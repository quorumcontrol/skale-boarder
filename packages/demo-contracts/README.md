# Demo contracts showing the uses of the skale-tools repo

This repo is designed to show you how easy it is to setup the skale-tools tools to also deploy a user onboarding system of contracts to your chain. The deploy is deterministic and so you can run that as many times you want on as many chains as you want and the onboarding contracts will end up with the same address.

## IMPORTANT ##

If deploying to production or testnet sChain make sure to allow `0x1aB62e2DDa7a02923A06904413A007f8e257e0D0` as a deployer.

## Setup ##

To run this locally `npx hardhat node` and then in another terminal `npx run addresses` (see package.json for the details of that).