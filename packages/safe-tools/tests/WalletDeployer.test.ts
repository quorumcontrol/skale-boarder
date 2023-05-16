
import { expect } from 'chai'
import { ContractTransactionReceipt, VoidSigner, constants } from 'ethers'
import { deployments, ethers } from 'hardhat'
import { authenticateTokenRequest, getBytesAndCreateToken } from '../src/tokenCreator'
import { EnglishOwnerAdder, EnglishOwnerRemover, GnosisSafeL2__factory, GnosisSafeProxyFactory__factory, WalletDeployer } from '../typechain-types'
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"

const SENTINEL_ADDRESS = '0x0000000000000000000000000000000000000001'

describe("WalletDeployer", () => {
    const setupTest = deployments.createFixture(
        async ({ deployments, getNamedAccounts, ethers }) => {
            await deployments.fixture(); // ensure you start from a fresh deployments
            const deploys = await deployments.all()

            const { deployer: deployerAddress } = await getNamedAccounts();
            const deployer = await ethers.getSigner(deployerAddress)
            const signers = await ethers.getSigners()

            const walletDeployer = (await ethers.getContractFactory("WalletDeployer")).attach(deploys.WalletDeployer.address).connect(deployer) as WalletDeployer
            return { deployer, signers, walletDeployer, deploys, englishOwnerAddr: deploys.EnglishOwnerAdder.address }
        }
    );

    it('generates verifiable token requests', async () => {
        const { walletDeployer, signers } = await setupTest()

        const { tokenRequest, signature } = await getBytesAndCreateToken(walletDeployer, signers[0], await signers[1].getAddress())

        expect(await authenticateTokenRequest(await walletDeployer.STATEMENT(), tokenRequest, signature)).to.be.true
    })

    async function proxyAddressFromReceipt(receipt: ContractTransactionReceipt) {
        const proxyContract = GnosisSafeProxyFactory__factory.connect(constants.AddressZero, new VoidSigner(""))

        const proxyCreationEvent = receipt?.events?.map((e) => {
            try {
                return proxyContract.interface.parseLog(e)
            } catch (err) {
                return null
            }
        }).find(
            (evt:any) => {
                return evt?.name === "ProxyCreation"
            }
        )
        if (!proxyCreationEvent || !proxyCreationEvent.args) {
            console.error(proxyCreationEvent, proxyCreationEvent?.args)
            throw new Error('SafeProxy was not deployed correctly')
        }
        return proxyCreationEvent.args[0]
    }

    it("uses the wallet deployer to deploy a safe", async () => {
        const { signers, walletDeployer, englishOwnerAddr } = await setupTest()
        const alice = signers[1]
        const walletCreator = walletDeployer.connect(alice)
        const aliceDevice = signers[2]

        const { tokenRequest, signature } = await getBytesAndCreateToken(walletDeployer, alice, aliceDevice.address)
        const tx = walletCreator.createSafe(tokenRequest, signature, englishOwnerAddr, [])
        await expect(tx).to.not.be.reverted

        // const safeFactory = await SafeFactory.create({ ethAdapter, contractNetworks })

        const receipt = await (await tx).wait()
        const proxyAddress = await proxyAddressFromReceipt(receipt)

        const safe = GnosisSafeL2__factory.connect(proxyAddress, alice)
        expect(await safe.getOwners()).to.have.lengthOf(2)
        // console.log("owners", await safe.getOwners())
        expect(await safe.isOwner(aliceDevice.address)).to.be.true
    })

    it("saves wallet address", async () => {
        const { signers, walletDeployer, englishOwnerAddr } = await setupTest()
        const alice = signers[1]
        const walletCreator = walletDeployer.connect(alice)
        const aliceDevice = signers[2]

        const { tokenRequest, signature } = await getBytesAndCreateToken(walletDeployer, alice, aliceDevice.address)
        const tx = walletCreator.createSafe(tokenRequest, signature, englishOwnerAddr, [])
        await expect(tx).to.not.be.reverted

        // const safeFactory = await SafeFactory.create({ ethAdapter, contractNetworks })

        const receipt = await (await tx).wait()
        const proxyAddress = await proxyAddressFromReceipt(receipt)

        expect(await walletDeployer.ownerToSafe(alice.address)).to.equal(proxyAddress)
        expect(await walletDeployer.safeToOwner(proxyAddress)).to.equal(alice.address)
    })

    describe("EnglishOwnerAdder", () => {
        const fixture = async () => {
            const { signers, deployer, walletDeployer, englishOwnerAddr } = await setupTest()
            const alice = signers[1]
            const aliceDevice = signers[2]

            const englishOwnerAdder = (await ethers.getContractFactory("EnglishOwnerAdder")).attach(englishOwnerAddr).connect(deployer) as EnglishOwnerAdder
            const { tokenRequest, signature } = await getBytesAndCreateToken(walletDeployer, alice, aliceDevice.address)

            const receipt = await (await (walletDeployer as WalletDeployer).createSafe(tokenRequest, signature, englishOwnerAddr, [])).wait()

            const proxyAddress = await proxyAddressFromReceipt(receipt)

            const safe = GnosisSafeL2__factory.connect(proxyAddress, alice)
            expect(await safe.getOwners()).to.have.lengthOf(2)

            return { englishOwnerAdder, signers, deployer, safe, alice, aliceDevice, walletDeployer }
        }

        it("adds the english owner adder at setup", async () => {
            const { englishOwnerAdder, safe } = await loadFixture(fixture)
            expect(await safe.isModuleEnabled(englishOwnerAdder.address)).to.be.true
        })

        it("can add an owner using an english signed token", async () => {
            const { englishOwnerAdder, signers, safe, alice } = await loadFixture(fixture)
            const newOwner = signers[3]
            const { tokenRequest, signature } = await getBytesAndCreateToken(englishOwnerAdder, alice, newOwner.address)
            const tx = englishOwnerAdder.addOwner(
                safe.address,
                tokenRequest,
                signature
            )
            await expect(tx).to.not.be.reverted
            expect(await safe.isOwner(newOwner.address)).to.be.true
            expect(await safe.getOwners()).to.have.lengthOf(3)
        })
    })

    describe("EnglishOwnerRemover", () => {
        const fixture = async () => {
            const { signers, deployer, deploys, walletDeployer, englishOwnerAddr } = await setupTest()
            const alice = signers[1]
            const aliceDevice = signers[2]

            const englishOwnerRemover = (await ethers.getContractFactory("EnglishOwnerRemover")).attach(deploys.EnglishOwnerRemover.address).connect(deployer) as EnglishOwnerRemover
            
            const { tokenRequest, signature } = await getBytesAndCreateToken(walletDeployer, alice, aliceDevice.address)
            const receipt = await (await (walletDeployer as WalletDeployer).createSafe(tokenRequest, signature, englishOwnerAddr, [])).wait()
            expect(receipt).to.exist
            const proxyAddress = await proxyAddressFromReceipt(receipt)

            const safe = GnosisSafeL2__factory.connect(proxyAddress, alice)
            expect(await safe.getOwners()).to.have.lengthOf(2)

            return { englishOwnerRemover, signers, deployer, safe, alice, aliceDevice, walletDeployer }
        }

        it("is added at setup", async () => {
            const { englishOwnerRemover, safe } = await loadFixture(fixture)
            expect(await safe.isModuleEnabled(englishOwnerRemover.address)).to.be.true
        })

        it("can remove an owner using an english signed token", async () => {
            const { englishOwnerRemover, safe, alice, aliceDevice } = await loadFixture(fixture)
            
            // this is a little strange because we have to find the owner right before aliceDevice in the list of owners and use that as the value for previousOwner
            const owners = await safe.getOwners()
            const aliceDeviceIndex = owners.findIndex((o) => o === aliceDevice.address)
            const previousOwner = owners[Math.min(aliceDeviceIndex - 1, 0)]

            const { tokenRequest, signature } = await getBytesAndCreateToken(englishOwnerRemover, alice, aliceDevice.address)
            const tx = englishOwnerRemover.removeOwner(
                safe.address,
                previousOwner || SENTINEL_ADDRESS,
                tokenRequest,
                signature
            )
            await expect(tx).to.not.be.reverted

            expect(await safe.isOwner(aliceDevice.address)).to.be.false
            expect(await safe.getOwners()).to.have.lengthOf(1)
        })
    })

})