import { Chain } from "@rainbow-me/rainbowkit";
import { SkaleChainConfig as WagmiSkaleChainConfig, createChain as wagmiCreateChain } from "@skaleboarder/wagmi";

export interface SkaleChainConfig extends WagmiSkaleChainConfig {
    iconUrl?: Chain["iconUrl"]
    iconBackground?: Chain["iconBackground"];
}

export const createChain = (config: SkaleChainConfig):Chain => {
    const chain:Chain = wagmiCreateChain(config)
    chain.iconUrl = config.iconUrl
    chain.iconBackground = config.iconBackground
    return chain
}
