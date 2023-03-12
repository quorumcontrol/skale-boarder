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

        const SKALECreate2DeployerFactory = await ethers.getContractFactory("SKALECreate2Deployer");
        const SKALECreate2Deployer = await SKALECreate2DeployerFactory.deploy();
        await SKALECreate2Deployer.deployed();

        // Fixtures can return anything you consider useful for your tests
        return { SKALECreate2Deployer, owner, alice, bob };
    }

    it("deploys to the adddress that hardhat expects", async () => {
        const { SKALECreate2Deployer, alice } = await loadFixture(initialSetup)

        const testFactory = await ethers.getContractFactory("TestContract")

        // const functionSignature = 'deploy(bytes32,bytes)'

        // // Encode the calldata
        // const iface = new ethers.utils.Interface([functionSignature]);
        // const encodedParams = iface.encodeFunctionData('deploy', [defaultSalt, testFactory.bytecode]);

        const tx = await alice.sendTransaction({
            to: SKALECreate2Deployer.address,
            data: defaultSalt + testFactory.bytecode.slice(2),
            gasLimit: 9_000_000,
        })

        const receipt = await tx.wait()

        const deployedAt = SKALECreate2Deployer.interface.parseLog(receipt.logs[0]).args.contractAddress
        const expectedAddress = getCreate2Address(SKALECreate2Deployer.address, defaultSalt, testFactory.bytecode)
        expect(deployedAt).to.equal(expectedAddress)
    })

})