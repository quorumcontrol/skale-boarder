import { ContractNetworksConfig } from "@safe-global/safe-core-sdk";
import { expect } from "chai";
import { deployments, ethers } from "hardhat";
import { SafeRelayer } from "../src/wallet";
const { providers, Wallet } = ethers

class MemoryLocalStorage {
    private store: { [key: string]: string } = {}

    getItem(key: string) {
        return this.store[key]
    }

    setItem(key: string, value: string) {
        this.store[key] = value
    }
}

describe("SafeWrapper", () => {
    const setupTest = deployments.createFixture(
        async ({ deployments, getNamedAccounts, ethers }) => {
            await deployments.fixture(); // ensure you start from a fresh deployments
            const deploys = await deployments.all()

            const { deployer: deployerAddress } = await getNamedAccounts();
            const deployer = await ethers.getSigner(deployerAddress)
            const signers = await ethers.getSigners()

            const chainId = await deployer.provider!.getNetwork().then(n => n.chainId)

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

            const walletDeployer = (await ethers.getContractFactory("WalletDeployer")).attach(deploys.WalletDeployer.address).connect(deployer)

            const testContractFactory = await ethers.getContractFactory("TestContract")
            const testContract = await testContractFactory.deploy()
            await testContract.deployed()

            const relayer = new SafeRelayer({
                ethers,
                walletDeployerAddress: walletDeployer.address,
                EnglishOwnerAdderAddress: deploys.EnglishOwnerAdder.address,
                networkConfig: contractNetworks,
                provider: deployer.provider!,
                localStorage: new MemoryLocalStorage(),
                faucet: async (address: string) => {
                    await (await deployer.sendTransaction({
                        to: address,
                        value: ethers.utils.parseEther("2")
                    })).wait()
                }
            })

            return { deployer, signers, walletDeployer, deploys, contractNetworks, relayer, testContract, chainId }
        }
    );



    it("executes wrapped transactions", async () => {
        const { relayer, signers, testContract, contractNetworks, chainId } = await setupTest()
        
        await relayer.setSigner(signers[1])
        const wrapped = relayer.wrappedSigner()
        const tx = await testContract.connect(wrapped).echo("hi", false)
        const receipt = await tx.wait()
        
        expect(receipt.events?.length).to.equal(1)
        expect((receipt.events![0] as any).args.sender).to.equal((await relayer.safe)!.getAddress())
    });

    it("reverts correctly", async () => {
        const { relayer, signers, testContract } = await setupTest()
        
        await relayer.setSigner(signers[1])
        const wrapped = relayer.wrappedSigner()
        const tx = testContract.connect(wrapped).echo("hi", true, { gasLimit: 1000000, gasPrice: 100 })
        await expect(tx).to.be.reverted
    });

    it('executes reads on the target chain instead of the original signer chain', async () => {
        const { relayer, signers, testContract } = await setupTest()
        // first create a default polygon chain signer
        const provider = new providers.StaticJsonRpcProvider("https://polygon-rpc.com")
        const signer = Wallet.createRandom().connect(provider)

        await relayer.setSigner(signers[1])
        const wrapped = relayer.wrappedSigner()
        expect(await testContract.connect(wrapped).somethingToRead()).to.equal("helloWorld")

    })
})
