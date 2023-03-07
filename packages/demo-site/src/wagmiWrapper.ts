import { Wallet, WalletInstance } from "@rainbow-me/rainbowkit/dist/wallets/Wallet"
import { SafeRelayer } from "@skaleboarder/safe-tools"
import { providers, ethers, Signer } from "ethers"
import { Connector } from "wagmi"
import addresses from "./addresses.json"

const { contracts, chainId } = addresses

class MemoryLocalStorage {
    private store: { [key: string]: string } = {}

    getItem(key: string) {
        return this.store[key]
    }

    setItem(key: string, value: string) {
        this.store[key] = value
    }
}

const provider = new providers.StaticJsonRpcProvider("http://localhost:8545/")

const contractNetworks = {
    [chainId]: {
        safeMasterCopyAddress: contracts.GnosisSafe.address,
        safeProxyFactoryAddress: contracts.GnosisSafeProxyFactory.address,
        multiSendAddress: contracts.MultiSend.address,
        multiSendCallOnlyAddress: contracts.MultiSendCallOnly.address,
        fallbackHandlerAddress: contracts.CompatibilityFallbackHandler.address,
        signMessageLibAddress: contracts.SignMessageLib.address,
        createCallAddress: contracts.CreateCall.address,
    }
}

const relayer = new SafeRelayer({
    ethers,
    EnglishOwnerAdderAddress: contracts.EnglishOwnerAdder.address,
    walletDeployerAddress: contracts.WalletDeployer.address,
    networkConfig: contractNetworks,
    provider: provider,
    localStorage: typeof localStorage !== "undefined" ? localStorage : new MemoryLocalStorage(),
    faucet: async (address: string) => {
        // TODO: demonstrate PoW on an schain
        const resp = await fetch("/api/localFaucet", {
            method: "POST",
            body: JSON.stringify({ address })
        })
        console.log("faucet succeeded", address, await resp.json())
    }
})

const wrapWallet = (wallet: Wallet) => {
    return new Proxy(wallet, {
        get: (target, prop) => {
            switch (prop) {
                case "createConnector":
                    return () => {
                        const original = target.createConnector()
                        original.connector = wrapConnector(original.connector)
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

const wrapConnector = (connector: Connector) => {
    console.log("wrapping", connector)
    let signerPromise: Promise<Signer>

    const proxy = new Proxy(connector, {
        get: (target, prop) => {
            switch (prop) {
                case "getProvider":
                    console.log('get provider: ', provider)
                    return async () => {
                        return provider
                    }
                case "getSigner":
                    console.log("get getSigner")
                    return () => {
                        console.log('getSigner called')
                        if (signerPromise) {
                            return signerPromise
                        }
                        signerPromise = (async () => {
                            console.log("get signer, creating new")
                            const original = await target.getSigner()
                            await relayer.setSigner(original)
                            console.log('returning wrapped signer')
                            return relayer.wrappedSigner()
                        })()
                        return signerPromise
                    }
                default:
                    const original = (target as any)[prop]
                    console.log("other prop: ", prop, original)
                    if (typeof original === "function") {
                        return (...args: any[]) => {
                            return original.apply(target, args)
                        }
                    }
                    return original
            }
        }
    })
    return proxy
}

export default wrapWallet