
import { expect } from 'chai'
import { ContractReceipt } from 'ethers'
import { deployments, ethers } from 'hardhat'
import EthersAdapter from '@safe-global/safe-ethers-lib'
import Safe, { SafeFactory } from '@safe-global/safe-core-sdk'
import { SafeAccountConfig } from '../safe-core-sdk/packages/safe-core-sdk/src'
import { ContractNetworksConfig } from '@safe-global/safe-core-sdk/dist/src/types'
import { getBytesAndCreateToken } from '../src/tokenCreator'
import { EnglishOwnerAddition, WalletDeployer } from '../typechain-types'
import { Proxy_factory__factory } from "@safe-global/safe-ethers-lib/dist/typechain/src/ethers-v5/v1.3.0"

describe("the safe SDK works", () => {
    const setupTest = deployments.createFixture(
        async ({ deployments, getNamedAccounts, ethers }, options) => {
            await deployments.fixture(); // ensure you start from a fresh deployments
            const deploys = await deployments.all()

            const { deployer: deployerAddress } = await getNamedAccounts();
            const deployer = await ethers.getSigner(deployerAddress)
            const signers = await ethers.getSigners()

            const ethAdapter = new EthersAdapter({
                ethers,
                signerOrProvider: deployer
            })

            const chainId = await ethAdapter.getChainId()

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

            const walletDeployer = (await ethers.getContractFactory("WalletDeployer")).attach(deploys.WalletDeployer.address).connect(deployer) as WalletDeployer
            return { deployer, signers, walletDeployer, deploys, contractNetworks, ethAdapter }
        }
    );

    it("allows safe creation with sdk", async () => {
        const { deployer, ethAdapter, contractNetworks, signers } = await setupTest()

        const safeFactory = await SafeFactory.create({ ethAdapter, contractNetworks })
        const owners = [deployer.address,  signers[1].address]
        const threshold = 1
        const safeAccountConfig: SafeAccountConfig = {
            owners,
            threshold,
            // ...
        }

        const safe: Safe = await safeFactory.deploySafe({ safeAccountConfig })
        expect(safe).to.be.ok
        expect(await safe.getOwners()).to.have.lengthOf(2)
        expect(await safe.isOwner(deployer.address)).to.be.true
    })

    async function proxyAddressFromReceipt(receipt:ContractReceipt, ethAdapter:EthersAdapter, contractNetworks:ContractNetworksConfig) {
        const proxyContract = ethAdapter.getSafeProxyFactoryContract({ 
            safeVersion: "1.3.0",
            chainId: await ethAdapter.getChainId(),
            customContractAddress: contractNetworks[await ethAdapter.getChainId()].safeProxyFactoryAddress
        })

        const proxyCreationEvent = receipt?.events?.map((e) => {
            try {
                return proxyContract.contract.interface.parseLog(e)
            } catch (err) {
                return null
            }
        }).find(
            (evt) => {
                return evt?.name === "ProxyCreation"
            }
        )
        if (!proxyCreationEvent || !proxyCreationEvent.args) {
            console.log(proxyCreationEvent, proxyCreationEvent?.args)
            throw new Error('SafeProxy was not deployed correctly')
        }
        return proxyCreationEvent.args[0]
    }

    it("can use the wallet deployer to deploy a safe", async () => {
        const { signers, walletDeployer, ethAdapter, contractNetworks } = await setupTest()
        const alice = signers[1]
        const walletCreator = walletDeployer.connect(alice)
        const aliceDevice = signers[2]

        const token = await getBytesAndCreateToken(walletDeployer, alice, aliceDevice)
        const tx = walletCreator.createSafe({
            owner: alice.address,
            firstDevice: aliceDevice.address,
            issuedAt: token.issuedAt,
        }, token.signature)
        await expect(tx).to.not.be.reverted

        // const safeFactory = await SafeFactory.create({ ethAdapter, contractNetworks })

        const receipt = await (await tx).wait()
        const proxyAddress = await proxyAddressFromReceipt(receipt, ethAdapter, contractNetworks)

        const safe = await Safe.create({ ethAdapter, contractNetworks, safeAddress: proxyAddress })
        expect(await safe.getOwners()).to.have.lengthOf(2)
        expect(await safe.isOwner(aliceDevice.address)).to.be.true
    })

    it("can setup the english owner adder at creation", async () => {
        const { signers, deployer, deploys, walletDeployer, ethAdapter, contractNetworks } = await setupTest()
        const alice = signers[1]
        const aliceDevice = signers[2]

        // const englishOwnerAdder = (await ethers.getContractFactory("EnglishOwnerAddition")).attach(deploys.EnglishOwnerAddition.address).connect(deployer) as EnglishOwnerAddition
        const token = await getBytesAndCreateToken(walletDeployer, alice, aliceDevice)

        const receipt = await (await (walletDeployer as WalletDeployer).createSafe({
            owner: alice.address,
            firstDevice: aliceDevice.address,
            issuedAt: token.issuedAt,
        }, token.signature)).wait()

        const proxyAddress = await proxyAddressFromReceipt(receipt, ethAdapter, contractNetworks)

        const safe = await Safe.create({ ethAdapter, contractNetworks, safeAddress: proxyAddress })
        expect(await safe.getOwners()).to.have.lengthOf(2)
    })
})