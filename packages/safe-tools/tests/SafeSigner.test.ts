import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { MemoryLocalStorage, SafeRelayer } from "../src/SafeRelayer";
import {  WalletDeployer__factory } from "../typechain-types";
const { providers, Wallet } = ethers

describe("SafeSigner", () => {
    const setupTest = deployments.createFixture(
        async ({ deployments, getNamedAccounts, ethers }) => {
            await deployments.fixture(); // ensure you start from a fresh deployments
            const deploys = await deployments.all()

            const { deployer: deployerAddress } = await getNamedAccounts();
            const deployer = await ethers.getSigner(deployerAddress)
            const signers = await ethers.getSigners()

            const chainId = await deployer.provider!.getNetwork().then(n => n.chainId)

            const WalletDeployerFactory:WalletDeployer__factory = await ethers.getContractFactory("WalletDeployer")

            const walletDeployer = (WalletDeployerFactory).attach(deploys.WalletDeployer.address).connect(deployer)

            expect(Buffer.from(WalletDeployerFactory.bytecode.slice(2), "hex").length).to.be.lessThan(28_000)

            const testContractFactory = await ethers.getContractFactory("TestContract")
            const testContract = await testContractFactory.deploy()
            await testContract.deployed()

            const localStorage = new MemoryLocalStorage()

            const relayer = new SafeRelayer({
                ethers,
                signer: signers[1],
                walletDeployerAddress: walletDeployer.address,
                EnglishOwnerAdderAddress: deploys.EnglishOwnerAdder.address,
                // networkConfig: contractNetworks,
                provider: deployer.provider!,
                localStorage,
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

            return { deployer, signers, walletDeployer, deploys, relayer, testContract, chainId, englishOwnerAddr: deploys.EnglishOwnerAdder.address, localStorage }
        }
    );

    it("executes wrapped transactions", async () => {
        const { relayer, testContract } = await setupTest()
        
        const wrapped = relayer.wrappedSigner()
        const tx = await testContract.connect(wrapped).echo("hi", false)
        const receipt = await tx.wait()
        
        expect(receipt.events?.length).to.equal(1)
        expect((receipt.events![0] as any).args.sender).to.equal((await relayer.safe)!.address)
    });

    it("finds a wallet that is already deployed", async () => {
        const { signers, deployer, walletDeployer, deploys, localStorage, relayer} = await setupTest()

        const newRelayer = new SafeRelayer({
            ethers,
            signer: signers[1],
            walletDeployerAddress: walletDeployer.address,
            EnglishOwnerAdderAddress: deploys.EnglishOwnerAdder.address,
            provider: deployer.provider!,
            localStorage,
            faucet: async (address: string) => {
                await (await deployer.sendTransaction({
                    to: address,
                    value: ethers.utils.parseEther("2")
                })).wait()
            }
        })

        expect(await relayer.localRelayer.getAddress()).to.equal(await newRelayer.localRelayer.getAddress())
    })

    describe("proof of relayer", () => {

        it("proves when safe is already deployed", async () => {
            const { relayer} = await setupTest()
            const proof = await relayer.proofOfRelayer()
            expect(proof).to.not.be.undefined
            expect(proof.safeDeployed).to.be.true
            expect(proof.relayer.address).to.equal(await relayer.localRelayer.getAddress())
        })

        it("proves when safe is not deployed", async () => {
            const { signers, deployer, walletDeployer, deploys } = await setupTest()
            const relayer = new SafeRelayer({
                ethers,
                signer: signers[2],
                walletDeployerAddress: walletDeployer.address,
                EnglishOwnerAdderAddress: deploys.EnglishOwnerAdder.address,
                provider: deployer.provider!,
                localStorage: new MemoryLocalStorage(),
                faucet: async (address: string) => {
                    // delay the faucet so that safe creation takes a long time
                    // and gives our proofOfRelayer time to run without deploying the safe
                    await new Promise(resolve => setTimeout(resolve, 200))
                    await (await deployer.sendTransaction({
                        to: address,
                        value: ethers.utils.parseEther("2")
                    })).wait()
                }
            })
            const proof = await relayer.proofOfRelayer()
            expect(proof).to.not.be.undefined
            expect(proof.safeDeployed).to.be.false
            expect(proof.relayer.address).to.equal(await relayer.localRelayer.getAddress())
            expect(proof.tokenRequest).to.exist  
            expect(proof.tokenRequestSignature).to.exist  
        })
    })

    it("predicts address", async () => {
        const { relayer } = await setupTest()
        const addr = await relayer.predictedSafeAddress()
        expect(addr).to.equal((await relayer.safe!).address)
    })

    it("finds the same safe again with a new relayer", async () => {
        const { relayer, signers, testContract, walletDeployer, deploys, deployer } = await setupTest()

        const newRelayer = new SafeRelayer({
            ethers,
            signer: signers[1],
            walletDeployerAddress: walletDeployer.address,
            EnglishOwnerAdderAddress: deploys.EnglishOwnerAdder.address,
            provider: deployer.provider!,
            faucet: async (address: string) => {
                await (await deployer.sendTransaction({
                    to: address,
                    value: ethers.utils.parseEther("2")
                })).wait()
            }
        })

        const existingSafe = await relayer.safe!
        
        
        expect((await newRelayer.safe).address).to.equal(existingSafe.address)

        const wrapped = relayer.wrappedSigner()
        await expect(testContract.connect(wrapped).echo("hi", false)).to.not.be.reverted
    });

    it('executes a transaction after a fire-and-forget setSigner', async () => {
        const { relayer, testContract } = await setupTest()
        
        const wrapped = relayer.wrappedSigner()
        const tx = await testContract.connect(wrapped).echo("hi", false)
        const receipt = await tx.wait()
        
        expect(receipt.events?.length).to.equal(1)
        expect((receipt.events![0] as any).args.sender).to.equal((await relayer.safe).address)
    })


    it('waits for safe', async () => {
        const { relayer } = await setupTest()
        
        const wrapped = relayer.wrappedSigner()
        const safe = await wrapped.waitForSafe()
        expect(safe).to.exist
    })

    it("reverts correctly", async () => {
        const { relayer, testContract } = await setupTest()
        
        const wrapped = relayer.wrappedSigner()
        const tx = testContract.connect(wrapped).echo("hi", true, { gasLimit: 1000000, gasPrice: 100 })
        await expect(tx).to.be.reverted
    });

    it('executes reads on the target chain instead of the original signer chain', async () => {
        const { testContract, walletDeployer, deploys, deployer } = await setupTest()
        // first create a default polygon chain signer
        const provider = new providers.StaticJsonRpcProvider("https://polygon-rpc.com")
        const signer = Wallet.createRandom().connect(provider)

        const relayer = new SafeRelayer({
            ethers,
            signer: signer,
            walletDeployerAddress: walletDeployer.address,
            EnglishOwnerAdderAddress: deploys.EnglishOwnerAdder.address,
            provider: deployer.provider!,
            faucet: async (address: string) => {
                await (await deployer.sendTransaction({
                    to: address,
                    value: ethers.utils.parseEther("2")
                })).wait()
            }
        })

        const wrapped = relayer.wrappedSigner()
        expect(await testContract.connect(wrapped).somethingToRead()).to.equal("helloWorld")

    })
})
