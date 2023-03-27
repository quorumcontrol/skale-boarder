import { useAccount, useProvider, useQuery } from "wagmi"
import { WalletDeployer__factory } from "@skaleboarder/safe-tools"

const useWalletDeployer = (address:string = "0x7F425D92f24806450f1673CafDaDfFa20f9F3f10") => {
    const provider = useProvider()

    return WalletDeployer__factory.connect(address, provider)
}

export const useSafeFromUser = (walletDeployerAddress?:string) => {
    const { address, isConnected } = useAccount()
    const walletDeployer = useWalletDeployer(walletDeployerAddress)

    return useQuery(
        ["safeFromUser", address],
        async () => {
            return walletDeployer.ownerToSafe(address!)
        },
        {
            enabled: isConnected && !!address,
        }
    )
}

export const useUserFromSafe = (safeAddr?:string, walletDeployerAddress?:string) => {
    const walletDeployer = useWalletDeployer(walletDeployerAddress)

    return useQuery(
        ["userFromSafe", safeAddr],
        async () => {
            return walletDeployer.safeToOwner(safeAddr!)
        },
        {
            enabled: !!safeAddr
        }
    )
}