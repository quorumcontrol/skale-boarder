import { expect } from "chai";
import { deployments } from "hardhat";
import { TestContract } from "../typechain-types";
import { MultiCaller } from "../src/Multicaller";

describe("Multicaller", () => {
  const setupTest = deployments.createFixture(
    async ({ deployments, getNamedAccounts, ethers }) => {
      await deployments.fixture(); // ensure you start from a fresh deployments
      const deploys = await deployments.all();

      const { deployer: deployerAddress } = await getNamedAccounts();
      const deployer = await ethers.getSigner(deployerAddress);
      const signers = await ethers.getSigners();

      const testContractFactory = await ethers.getContractFactory("TestContract")
      const testContract = await testContractFactory.deploy()
      await testContract.deployed()

      return { deployer, signers, testContract, deploys };
    },
  );

  it("allows safe creation with sdk", async () => {
    const { deployer, testContract, signers } = await setupTest();

    const multiCaller = new MultiCaller(deployer.provider!)

    const call = await testContract.populateTransaction.somethingToRead()

    const [res1, res2] = await Promise.all([
      multiCaller.call(call),
      multiCaller.call(call),
    ])

    expect(res1).to.equal("0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000a68656c6c6f576f726c6400000000000000000000000000000000000000000000") // helloworld
    expect(res2).to.equal("0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000a68656c6c6f576f726c6400000000000000000000000000000000000000000000")
  });
});
