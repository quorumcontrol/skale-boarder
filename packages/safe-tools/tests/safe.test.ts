
import { expect } from 'chai'
import { deployments, getNamedAccounts, ethers } from 'hardhat'
import EthersAdapter from '@safe-global/safe-ethers-lib'
import Safe, { SafeFactory } from '@safe-global/safe-core-sdk'
import { SafeAccountConfig } from '../safe-core-sdk/packages/safe-core-sdk/src'
import { ContractNetworksConfig } from '@safe-global/safe-core-sdk/dist/src/types'

describe("the safe SDK works", () => {
    const setupTest = deployments.createFixture(
        async ({ deployments, getNamedAccounts, ethers }, options) => {
            await deployments.fixture(); // ensure you start from a fresh deployments
            const { deployer: deployerAddress } = await getNamedAccounts();
            //   const artifacts = await deployments.getArtifact("GnosisSafe")
            //   console.log("artifacts: ", artifacts)
            //   console.log("contract: ", contract)
            const deployer = await ethers.getSigner(deployerAddress)
            return { deployer }
        }
    );

    it("works", async () => {
        const { deployer } = await setupTest()

        const ethAdapter = new EthersAdapter({
            ethers,
            signerOrProvider: deployer
        })

        const chainId = await ethAdapter.getChainId()
        const deploys = await deployments.all()

        const contractNetworks: ContractNetworksConfig = {
            [chainId]: {
                safeMasterCopyAddress: deploys.GnosisSafe.address,
                safeProxyFactoryAddress: deploys.GnosisSafeProxyFactory.address,
                multiSendAddress: deploys.MultiSend.address,
                multiSendCallOnlyAddress: deploys.MultiSendCallOnly.address,
                fallbackHandlerAddress: deploys.CompatibilityFallbackHandler.address,
                signMessageLibAddress: deploys.SignMessageLib.address,
                createCallAddress: deploys.CreateCall.address,
            }
        }

        const safeFactory = await SafeFactory.create({ ethAdapter, contractNetworks })
        const owners = [deployer.address]
        const threshold = 1
        const safeAccountConfig: SafeAccountConfig = {
            owners,
            threshold,
            // ...
        }

        const safeSdk: Safe = await safeFactory.deploySafe({ safeAccountConfig })


    })
})