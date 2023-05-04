import { useAccount, useProvider, useQuery, useSigner } from "wagmi"
import { WalletDeployer__factory } from "@skaleboarder/safe-tools"
import { SafeSigner } from '@skaleboarder/safe-tools'

const useWalletDeployer = (address:string = "0x7F425D92f24806450f1673CafDaDfFa20f9F3f10") => {
    const provider = useProvider()

    return WalletDeployer__factory.connect(address, provider)
}

export const useSafeFromUser = () => {
    const { address, isConnected } = useAccount()
    const { data:signer } = useSigner()

    return useQuery(
        ["safeFromUser", address],
        async () => {
            const safe = await (signer as SafeSigner).waitForSafe()
            return safe.getAddress()
        },
        {
            enabled: isConnected && !!signer,
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