import { loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { expect } from "chai";
import { ethers } from "hardhat"

describe("SKALECreate2Deployer", function () {
  async function initialSetup() {
    const [owner, alice, bob] = await ethers.getSigners();

    const dummyFactory = await ethers.getContractFactory("DummyConfigController");
    const dummyConfigController = await dummyFactory.deploy()
    await dummyConfigController.deployed()

    const SKALECreate2DeployerFactory = await ethers.getContractFactory("SKALECreate2Deployer");
    const SKALECreate2Deployer = await SKALECreate2DeployerFactory.deploy();
    SKALECreate2Deployer.initialize(dummyConfigController.address);
    await SKALECreate2Deployer.deployed();

    // Fixtures can return anything you consider useful for your tests
    return { SKALECreate2Deployer, dummyConfigController, owner, alice, bob };
  }

  it("deploys when authorized to deploy", async () => {
    const { SKALECreate2Deployer, dummyConfigController, alice } = await loadFixture(initialSetup)
    await dummyConfigController.setAllowed(alice.address, true)

    const testFactory = await ethers.getContractFactory("TestContract")

    await expect(SKALECreate2Deployer.connect(alice).deploy(testFactory.bytecode, Buffer.from("thisismysalt"))).to.not.be.reverted
  })

  it("does not deploy when not authorized", async () => {
    const { SKALECreate2Deployer, dummyConfigController, alice } = await loadFixture(initialSetup)
    await dummyConfigController.setAllowed(alice.address, false)

    const testFactory = await ethers.getContractFactory("TestContract")

    await expect(SKALECreate2Deployer.connect(alice).deploy(testFactory.bytecode, Buffer.from("thisismysalt"))).to.be.revertedWithCustomError(SKALECreate2Deployer, "UnauthorizedMustBeAllowedToDeploy")
  })

})