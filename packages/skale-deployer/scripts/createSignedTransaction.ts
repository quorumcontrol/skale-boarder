import { BigNumber, utils } from "ethers";
import { ethers } from "hardhat";

async function main() {

  const SKALECreate2DeployerFactory = await ethers.getContractFactory("SKALECreate2Deployer");
  const originalSigner = SKALECreate2DeployerFactory.signer
  const signer = ethers.Wallet.createRandom().connect(originalSigner.provider!)

  const fundingTx = await originalSigner.sendTransaction({
    to: "0x1aB62e2DDa7a02923A06904413A007f8e257e0D0",
    value: utils.parseEther("2"),
  })

  await fundingTx.wait()

  const tx = SKALECreate2DeployerFactory.connect(originalSigner).getDeployTransaction()

  const populated = await signer.populateTransaction(tx)
  delete populated.chainId

  const v = 27
  const r = ('0x2222222222222222222222222222222222222222222222222222222222222222')
  const s = ('0x2222222222222222222222222222222222222222222222222222222222222222')

  console.log("populated: ", populated)

  const signed = utils.serializeTransaction(
    {
      nonce: 0,
      gasPrice: BigNumber.from(100 * 10**9),
      gasLimit: BigNumber.from(populated.gasLimit).mul(115).div(100),
      to: populated.to,
      value: populated.value,
      data: populated.data,
    },
    {
      v,
      r,
      s,
    }
  )


  // const signed = await signer.signTransaction(populated)
  console.log("signed: ", utils.parseTransaction(signed))

  const sent = await signer.provider!.sendTransaction(signed)

  const receipt = await sent.wait()

  // const signer = deployed.signer

  // const tx = deployed.deployTransaction

  console.log("tx: ", signed)
  console.log("signer: ", utils.parseTransaction(signed).from)
  console.log("address: ", receipt.contractAddress)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
