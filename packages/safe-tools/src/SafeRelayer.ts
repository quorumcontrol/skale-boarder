import { providers, Signer, ethers, BigNumber, constants, BytesLike } from 'ethers'
import { getBytesAndCreateToken } from './tokenCreator'
import { EnglishOwnerAdder, EnglishOwnerAdder__factory, TokenAuthenticated, WalletDeployer, WalletDeployer__factory } from '../typechain-types'
import SimpleSyncher from './SimpleSyncher'
import Safe, { EthersAdapter, ContractNetworksConfig, PredictedSafeProps } from '@safe-global/protocol-kit'
import { SafeSigner, SafeSignerOptions } from './SafeSigner'
import addresses from './addresses'

type TokenRequest = TokenAuthenticated.TokenRequestStructOutput

const KEY_FOR_PRIVATE_KEY = 'safe-relayer-pk'

const setupEncoded = () => {
    const ABI = ["function setup()"];
    const iface = new ethers.utils.Interface(ABI);
    return iface.encodeFunctionData("setup");
}

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

    networkConfig: ContractNetworksConfig
    provider: providers.Provider
    faucet: (address: Address, signer?:Signer) => Promise<void>
    localStorage?: LocalStorage
    signerOptions?: SafeSignerOptions
    walletDeployerAddress?: Address
    EnglishOwnerAdderAddress?: Address
    setupHandlerAddress?: Address
}

export class SafeRelayer {
    private config: UserRelayerProps
    private ethAdapter: EthersAdapter
    private walletDeployer: WalletDeployer
    private englishAdder: EnglishOwnerAdder
    private _wrappedSigner?: SafeSigner

    private setupHandlerAddress: Address
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
        this.walletDeployer = WalletDeployer__factory.connect(config.walletDeployerAddress || addresses.WalletDeployer, this.localRelayer)
        this.englishAdder = EnglishOwnerAdder__factory.connect(config.EnglishOwnerAdderAddress || addresses.WalletDeployer, this.localRelayer)
        this.ethAdapter = new EthersAdapter({
            ethers: ethers,
            signerOrProvider: this.localRelayer,
        })
        this.singleton = new SimpleSyncher("safe-relayer")
        // this signer is the original signer, we'll use it to approve the safe.
        this.setupSignerAndFindOrCreateSafe(config.signer)
        this.setupHandlerAddress = config.setupHandlerAddress || addresses.SafeSetup
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
        this._wrappedSigner = new SafeSigner(this, this.config.signerOptions)
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

    async predictedSafeAddress() {
        if (!this.originalSigner) {
            return undefined
        }

        // console.log(
        //     "fallback: ", addresses.CompatibilityFallbackHandler, 
        //     "setup:", this.setupHandlerAddress,
        //     "encoded", setupEncoded(),
        //     "signer", await this.originalSigner.getAddress(),
        // )

        const props:PredictedSafeProps = {
            safeAccountConfig: {
                owners: [await this.originalSigner.getAddress()],
                threshold: 1,
                to: this.setupHandlerAddress.toLowerCase(),
                data: setupEncoded(),
                fallbackHandler: addresses.CompatibilityFallbackHandler,
                payment: 0,
                paymentReceiver: constants.AddressZero,
                paymentToken: constants.AddressZero,
            },
            safeDeploymentConfig: {
                safeVersion: '1.3.0',
                saltNonce: BigNumber.from(await this.localRelayer.getChainId()).toHexString(),
            }
        }

        const safe = await Safe.create({
            ethAdapter: this.ethAdapter,
            predictedSafe: props,
            contractNetworks: this.config.networkConfig,
        })
        return safe.getAddress()
    }

    private async createSafe(tokenRequest: TokenRequest, signature: BytesLike) {
        if (!this.originalSigner) {
            throw new Error('No signer set')
        }
        try {
            // console.log('using faucet')
            // console.log("create safe")
            // const ownerAddr = await this.originalSigner.getAddress()
            // then we need to create a new safe
            const tx = await this.walletDeployer.createSafe(tokenRequest, signature, this.englishAdder.address, [])
            
            return tx.wait()
        } catch (err) {
            console.error("error creating safe: ", err)
            throw err
        }
    }

    private async addDevice(safe: Safe, tokenRequest: TokenRequest, signature: BytesLike) {
        try {
            if (!this.originalSigner) {
                throw new Error('No signer set')
            }
            const tx = await this.englishAdder.addOwner(
                await safe.getAddress(),
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

    private async _safe() {
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
                
                let safe = (addr === constants.AddressZero) ? undefined : await Safe.create({
                    ethAdapter: this.ethAdapter,
                    safeAddress: addr,
                    contractNetworks: this.config.networkConfig,
                })

                const deviceAddr = await this.localRelayer.getAddress()

                if (addr !== constants.AddressZero && await safe?.isOwner(deviceAddr)) {
                    return safe
                }
                // console.log("calling faucet")
                const { tokenRequest, signature } = await getBytesAndCreateToken(this.walletDeployer, this.originalSigner, deviceAddr)

                await this.config.faucet(await this.localRelayer.getAddress(), this.localRelayer)

                if (addr === ethers.constants.AddressZero) {
                    await this.createSafe(tokenRequest, signature)
                    addr = (await this.predictedSafeAddress())!
                }

                safe = await Safe.create({
                    ethAdapter: this.ethAdapter,
                    safeAddress: addr,
                    contractNetworks: this.config.networkConfig,
                })

                await this.addDevice(safe, tokenRequest, signature)
                // console.log("--------- safe created")
                return safe
            } catch (err) {
                console.error("error setting up safe", err)
                throw err
            }

        })
    }
}
