import 'hardhat-deploy'
import { DeployFunction } from 'hardhat-deploy/types'
import { HardhatRuntimeEnvironment } from 'hardhat/types'

const deploy: DeployFunction = async (hre: HardhatRuntimeEnvironment): Promise<void> => {
  const { deployments, getNamedAccounts } = hre
  const { deployer } = await getNamedAccounts()
  const { deploy } = deployments

  await deploy('Echo', {
    from: deployer,
    args: [],
    log: true,
  })
}

export default deploy
