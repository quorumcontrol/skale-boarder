import { Chain } from "wagmi";

export interface SkaleChainConfig {
    /** ID in number form */
    id: number
    /** Human-readable name */
    name: string
    /** Internal network name */
    network?: string
    rpcUrls: Chain["rpcUrls"]
    explorer: string
    testnet?: boolean
}

export const createChain = (config:SkaleChainConfig): Chain => {
    return {
        id: config.id,
        name: config.name,
        network: config.network || `skalechain-${config.id}`,
        nativeCurrency: {
            decimals: 18,
            name: 'sFUEL',
            symbol: 'sFUEL',
        },
        rpcUrls: config.rpcUrls,
        blockExplorers: {
            default: { name: 'BlockScout', url: config.explorer },
        },
        testnet: config.testnet,
    };
}
