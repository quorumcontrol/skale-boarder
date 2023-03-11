import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai";
import { getAddress, solidityKeccak256 } from "ethers/lib/utils";
import { ethers } from "hardhat"

const defaultSalt = "0x0000000000000000000000000000000000000000000000000000000000000000"

type Address = string

// taken from hardhat
function getCreate2Address(
    create2DeployerAddress: Address,
    salt: string,
    bytecode: string
): Address {
    return getAddress(
        '0x' +
        solidityKeccak256(
            ['bytes'],
            [
                `0xff${create2DeployerAddress.slice(2)}${salt.slice(
                    2
                )}${solidityKeccak256(['bytes'], [bytecode]).slice(2)}`,
            ]
        ).slice(-40)
    );
}

describe("SKALECreate2Deployer", function () {
    async function initialSetup() {
        const [owner, alice, bob] = await ethers.getSigners();

        const dummyFactory = await ethers.getContractFactory("DummyConfigController");
        const dummyConfigController = await dummyFactory.deploy()
        await dummyConfigController.deployed()

        const SKALECreate2DeployerFactory = await ethers.getContractFactory("SKALECreate2Deployer");
        const SKALECreate2Deployer = await SKALECreate2DeployerFactory.deploy(dummyConfigController.address);
        await SKALECreate2Deployer.deployed();

        // Fixtures can return anything you consider useful for your tests
        return { SKALECreate2Deployer, dummyConfigController, owner, alice, bob };
    }

    it("deploys when authorized to deploy", async () => {
        const { SKALECreate2Deployer, dummyConfigController, alice } = await loadFixture(initialSetup)
        await dummyConfigController.setAllowed(alice.address, true)

        const testFactory = await ethers.getContractFactory("TestContract")

        await expect(SKALECreate2Deployer.connect(alice).deploy(defaultSalt, testFactory.bytecode)).to.not.be.reverted
    })

    it("does not deploy when not authorized", async () => {
        const { SKALECreate2Deployer, dummyConfigController, alice } = await loadFixture(initialSetup)
        await dummyConfigController.setAllowed(alice.address, false)

        const testFactory = await ethers.getContractFactory("TestContract")

        await expect(SKALECreate2Deployer.connect(alice).deploy(defaultSalt, testFactory.bytecode)).to.be.revertedWithCustomError(SKALECreate2Deployer, "UnauthorizedMustBeAllowedToDeploy")
    })

    it("deploys to the adddress that hardhat expects", async () => {
        const { SKALECreate2Deployer, dummyConfigController, alice } = await loadFixture(initialSetup)
        await dummyConfigController.setAllowed(alice.address, true)

        const testFactory = await ethers.getContractFactory("TestContract")
        const tx = await SKALECreate2Deployer.connect(alice).deploy(defaultSalt, testFactory.bytecode)
        const receipt = await tx.wait()

        const deployedAt = SKALECreate2Deployer.interface.parseLog(receipt.logs[0]).args.contractAddress
        const expectedAddress = getCreate2Address(SKALECreate2Deployer.address, defaultSalt, testFactory.bytecode)
        expect(deployedAt).to.equal(expectedAddress)
    })

})