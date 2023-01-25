# Sample Hardhat Project

A deterministic deployer specifically for SKALE network schains.

Since on SKALE chains, deployment must be allowed per address (or opened completely), but
smart contracts are always allowed to deploy, we need this deployer to also check to see if a deployer
is allowed to deploy (as opposed to other chains where deployment is completely open).

Most code is taken from https://ftmscan.com/address/0x54f5a04417e29ff5d7141a6d33cb286f50d5d50e#code

Try running some of the following tasks:

```shell
npx hardhat test
```
