import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const deploy: DeployFunction = async (hre: HardhatRuntimeEnvironment): Promise<void> => {
  const { deployments, getNamedAccounts } = hre
  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  const safe = await deploy("GnosisSafe", {
    contract: "@gnosis.pm/safe-contracts-v1.3.0/contracts/GnosisSafe.sol:GnosisSafe",
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true
  })

  const factory = await deploy("GnosisSafeProxyFactory", {
    contract: "@gnosis.pm/safe-contracts-v1.3.0/contracts/proxies/GnosisSafeProxyFactory.sol:GnosisSafeProxyFactory",
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true
  })

  await deploy("MultiSend", {
    contract: "@gnosis.pm/safe-contracts-v1.3.0/contracts/libraries/MultiSend.sol:MultiSend",
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
    contract: "@gnosis.pm/safe-contracts-v1.3.0/contracts/libraries/CreateCall.sol:CreateCall",
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

  await deploy('DailyLimitModule', {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true
  })

  await deploy('SocialRecoveryModule', {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true
  })

  await deploy('ERC20Mintable', {
    from: deployer,
    args: [],
    log: true
  })

  await deploy('DebugTransactionGuard', {
    from: deployer,
    args: [],
    log: true
  })

  await deploy('DefaultCallbackHandler', {
    contract: "@gnosis.pm/safe-contracts-v1.3.0/contracts/handler/DefaultCallbackHandler.sol:DefaultCallbackHandler",
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true
  })


  const englishOwnerAdder = await deploy("EnglishOwnerAddition", {
    from: deployer,
    args: [],
    log: true,
    deterministicDeployment: true,
  })

  const setupHandler = await deploy("SafeSetup", {
    from: deployer,
    args: [englishOwnerAdder.address],
    log: true,
    deterministicDeployment: true,
  })

  await deploy("WalletDeployer", {
    from: deployer,
    args: [
      safe.address,
      factory.address,
      fallback.address,
      setupHandler.address,
    ],
    log: true,
    deterministicDeployment: true,
  })

}

export default deploy
