import { Wallet } from "@rainbow-me/rainbowkit/dist/wallets/Wallet"
import WagmiWrapper, { WagmiWrapperConfig } from "@skaleboarder/wagmi"

class RainbowKitWalletWrapper {
    private wagmiWrapper: WagmiWrapper

    constructor(config: WagmiWrapperConfig) {
        this.wagmiWrapper = new WagmiWrapper(config)
    }

    wrapWallet = (wallet: Wallet) => {
        return new Proxy(wallet, {
            get: (target, prop) => {
                switch (prop) {
                    case "createConnector":
                        return () => {
                            const original = target.createConnector()
                            original.connector = this.wagmiWrapper.wrapConnector(original.connector)
                            return original
                        }
                    default:
                        {
                            const original = (target as any)[prop]
                            if (typeof original === "function") {
                                return original.bind(target)
                            }
                            return original
                        }
    
                }
            }
        })
    }
}

export default RainbowKitWalletWrapper 
