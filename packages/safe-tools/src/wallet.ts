import { ContractNetworksConfig } from '@safe-global/safe-core-sdk'
import EthersAdapter from '@safe-global/safe-ethers-lib'
import { providers, Signer, ethers, BigNumber } from 'ethers'
import { getBytesAndCreateToken } from './tokenCreator'
import { EnglishOwnerAdder, EnglishOwnerAdder__factory, WalletDeployer, WalletDeployer__factory } from '../typechain-types'
import SimpleSyncher from './singletonQueue'
import Safe from '@safe-global/safe-core-sdk'
import { SafeSigner } from './SafeSigner'

const KEY_FOR_PRIVATE_KEY = 'safe-relayer-pk'

export class MemoryLocalStorage {
    private store: { [key: string]: string } = {}

    getItem(key: string) {
        return this.store[key]
    }

    setItem(key: string, value: string) {
        this.store[key] = value
    }
}

type Address = string

interface LocalStorage {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
}

export interface UserRelayerProps {
    signer: Signer
    ethers: typeof ethers
    walletDeployerAddress: Address
    EnglishOwnerAdderAddress: Address
    networkConfig: ContractNetworksConfig
    provider: providers.Provider
    faucet: (address: Address) => Promise<void>
    localStorage?: LocalStorage
}

export class SafeRelayer {
    private config: UserRelayerProps
    private ethAdapter: EthersAdapter
    private walletDeployer: WalletDeployer
    private englishAdder: EnglishOwnerAdder
    private _wrappedSigner?: Signer

    private localStorage: LocalStorage

    localRelayer: Signer
    singleton: SimpleSyncher
    originalSigner?: Signer

    // this is setup with setupSigner
    safe!: Promise<Safe>

    constructor(config: UserRelayerProps) {
        this.config = config
        this.localStorage = this.findDefaultLocalStorage()

        this.localRelayer = this.findOrCreateLocalRelayer()
        this.walletDeployer = WalletDeployer__factory.connect(config.walletDeployerAddress, this.localRelayer)
        this.englishAdder = EnglishOwnerAdder__factory.connect(config.EnglishOwnerAdderAddress, this.localRelayer)
        this.ethAdapter = new EthersAdapter({
            ethers: ethers,
            signerOrProvider: this.localRelayer,
        })
        this.singleton = new SimpleSyncher("safe-relayer")
        // this signer is the original signer, we'll use it to approve the safe.
        this.setupSignerAndFindOrCreateSafe(config.signer)
    }

    get provider() {
        return this.config.provider
    }

    // syntactic sugar to allow for  `await relayer.ready()` which makes
    // more inutitive sense than `await relayer.safe`
    get ready() {
        return this.safe
    }

    wrappedSigner() {
        if (this._wrappedSigner) {
            return this._wrappedSigner
        }
        this._wrappedSigner = new SafeSigner(this)
        return this._wrappedSigner
    }

    private findDefaultLocalStorage() {
        if (this.config.localStorage) {
            return this.config.localStorage
        }
        if (typeof localStorage !== "undefined") {
            return localStorage
        }
        if (typeof globalThis !== "undefined" && globalThis.localStorage) {
            return globalThis.localStorage
        }
        return new MemoryLocalStorage()
    }

    private findOrCreateLocalRelayer() {
        const pk = this.localStorage.getItem(KEY_FOR_PRIVATE_KEY)
        if (pk) {
            return new ethers.Wallet(pk, this.provider).connect(this.provider)
        }
        const wallet = ethers.Wallet.createRandom().connect(this.provider)
        this.localStorage.setItem(KEY_FOR_PRIVATE_KEY, wallet.privateKey)
        return wallet
    }

    private async createSafe() {
        if (!this.originalSigner) {
            throw new Error('No signer set')
        }
        try {
            // console.log("create safe")
            // const ownerAddr = await this.originalSigner.getAddress()
            const device = await this.localRelayer.getAddress()
            // then we need to create a new safe
            const { tokenRequest, signature } = await getBytesAndCreateToken(this.walletDeployer, this.originalSigner, device)
            const tx = await this.walletDeployer.createSafe(tokenRequest, signature)
            const receipt = await tx.wait()
            // console.log("safe created")
            return receipt
        } catch (err) {
            console.error("error creating safe: ", err)
            throw err
        }
    }

    private async maybeAddDevice(safe: Safe) {
        try {
            if (!this.originalSigner) {
                throw new Error('No signer set')
            }
            // console.log("---------- safe", safe)
            const safeAddr = safe.getAddress()
            const device = await this.localRelayer.getAddress()
            // console.log("local relayer")
            if (await safe.isOwner(device)) {
                // console.log("----------safe owner is device")
                return
            }
            // console.log("fetching token")
            // then we need to create a new safe
            const { tokenRequest, signature } = await getBytesAndCreateToken(this.englishAdder, this.originalSigner, device)
            const tx = await this.englishAdder.addOwner(
                safeAddr,
                tokenRequest,
                signature
            )
            // console.log("-------------- add device")
            return tx.wait()
        } catch (err) {
            console.error("error adding device: ", err)
            throw err
        }
    }

    private setupSignerAndFindOrCreateSafe(signer:Signer) {
        this.originalSigner = signer
        this.safe = this.singleton.push(async () => {
            try {
                if (!this.originalSigner) {
                    throw new Error('No signer set')
                }
                const originalAddr = await this.originalSigner.getAddress()
                let addr = await this.walletDeployer.ownerToSafe(originalAddr)
                // console.log("calling faucet")
                await this.config.faucet(await this.localRelayer.getAddress())

                if (addr === ethers.constants.AddressZero) {
                    await this.createSafe()
                    addr = await this.walletDeployer.ownerToSafe(originalAddr)
                }

                const safe = await Safe.create({
                    ethAdapter: this.ethAdapter,
                    safeAddress: addr,
                    contractNetworks: this.config.networkConfig,
                })
                await this.maybeAddDevice(safe)
                // console.log("--------- safe created")
                return safe
            } catch (err) {
                console.error("error setting up safe", err)
                throw err
            }

        })
    }
}
