import 'hardhat-deploy'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const deploy: DeployFunction = async (hre: HardhatRuntimeEnvironment): Promise<void> => {
  const { deployments, getNamedAccounts } = hre
  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  const safe = await deploy("GnosisSafe", {
    contract: "GnosisSafeL2",
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true
  })

  const factory = await deploy("GnosisSafeProxyFactory", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true
  })

  await deploy("MultiSend", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true
  })

  await deploy("MultiSendCallOnly", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true
  })

  await deploy("SignMessageLib", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true
  })

  await deploy("CreateCall", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true
  })

  const fallback = await deploy("CompatibilityFallbackHandler", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true
  })

  await deploy('DefaultCallbackHandler', {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true
  })

  const englishOwnerAdder = await deploy("EnglishOwnerAdder", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true,
  })

  const englishOwnerRmover = await deploy("EnglishOwnerRemover", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true,
  })

  const setupHandler = await deploy("SafeSetup", {
    from: deployer,
    args: [englishOwnerAdder.address, englishOwnerRmover.address],
    log: true,
    deterministicDeployment: true,
  })

  await deploy("WalletDeployer", {
    from: deployer,
    gasLimit: 3_000_000, // this fails on sChains without an explicit gas limit
    args: [
      safe.address,
      factory.address,
      fallback.address,
      setupHandler.address,
    ],
    log: true,
    deterministicDeployment: true,
  })

  await deploy("Multicall3", {
    from: deployer,
    gasLimit: 3_000_000,
    args: [],
    log: true,
    deterministicDeployment: true,
  })

}

export default deploy
