import { providers, Signer, ethers, BigNumber, constants, BytesLike } from 'ethers'
import { getBytesAndCreateToken, TokenRequest } from './tokenCreator'
import { EnglishOwnerAdder, EnglishOwnerAdder__factory, WalletDeployer, WalletDeployer__factory } from '../typechain-types'
import SimpleSyncher from './SimpleSyncher'
import Safe, { EthersAdapter, ContractNetworksConfig, PredictedSafeProps } from '@safe-global/protocol-kit'
import { SafeSigner, SafeSignerOptions } from './SafeSigner'
import addresses from './addresses'

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

export interface ProofOfRelayer {
    owner: Address
    relayer: {
        address: Address
        chainId: number
        exp: number 
    }
    signature: string

    safeDeployed: boolean
    // if the safe isn't deployed yet, we can use the user's
    // signed auth in order to prove this relayer is ok

    tokenRequest?: TokenRequest
    tokenRequestSignature?: BytesLike
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

    private authorization?: Promise<{ tokenRequest: TokenRequest, signature: BytesLike}>

    private faucetCalled = false

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

    async proofOfRelayer():Promise<ProofOfRelayer> {
        const proof = {
          address: await this.localRelayer.getAddress(),
          chainId: await this.localRelayer.getChainId(),
          exp: Math.ceil(new Date().getTime() / 1000) + (10 * 60) // 10 minutes
        }
      
        const relayerSignature = await this.localRelayer.signMessage(JSON.stringify(proof))

        let safe = await this.predictedSafe()
        const isDeployed = await safe.isSafeDeployed()
        if (isDeployed) {
            safe = await this.connectSafe(safe)
        }
        const isDeployedAndReady = isDeployed && await safe.isOwner(await this.localRelayer.getAddress())

        if (isDeployedAndReady) {
            return {
                owner: await this.originalSigner!.getAddress(),
                relayer: proof,
                signature: relayerSignature,
                safeDeployed: true,
            }
        }

        const { tokenRequest, signature } = await this.findOrCreateAuthorization()
        return {
            owner: await this.originalSigner!.getAddress(),
            relayer: proof,
            signature: relayerSignature,
            safeDeployed: false,
            tokenRequest,
            tokenRequestSignature: signature,
        }
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

    private async predictedSafe() {
        if (!this.originalSigner) {
            throw new Error("called predictedSafe before a signer was setup")
        }
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

        return Safe.create({
            ethAdapter: this.ethAdapter,
            predictedSafe: props,
            contractNetworks: this.config.networkConfig,
        })
    }

    async predictedSafeAddress() {
        if (!this.originalSigner) {
            return undefined
        }

        const safe = await this.predictedSafe()
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

    private findOrCreateAuthorization() {
        if (this.authorization) {
            return this.authorization
        }

        this.authorization = new Promise(async (resolve, reject) => {
            if (!this.originalSigner) {
                reject(new Error('No signer set'))
                return
            }
            resolve(getBytesAndCreateToken(this.walletDeployer, this.originalSigner, await this.localRelayer.getAddress()))
        })
        
        return this.authorization
    }

    private async callFaucetOnce() {
        if (this.faucetCalled) {
            return
        }
        this.faucetCalled = true

        return this.config.faucet(await this.localRelayer.getAddress(), this.localRelayer)
    }

    private async findOrCreateAuthorizationAndCallFaucet() {
        const [
            { tokenRequest, signature },
        ] = await Promise.all([
            this.findOrCreateAuthorization(),
            this.callFaucetOnce(),
        ])
        return { tokenRequest, signature }
    }

    private async connectSafe(safe:Safe):Promise<Safe> {
        return safe.connect({
            ethAdapter: this.ethAdapter,
            safeAddress: await safe.getAddress(),
            contractNetworks: this.config.networkConfig,
        })
    }

    private setupSignerAndFindOrCreateSafe(signer:Signer) {
        this.originalSigner = signer
        this.safe = this.singleton.push(async () => {
            try {
                if (!this.originalSigner) {
                    throw new Error('No signer set')
                }
                
                let safe = await this.predictedSafe()
                const isDeployed = await safe.isSafeDeployed()

                if (!isDeployed) {
                    const { tokenRequest, signature } = await this.findOrCreateAuthorizationAndCallFaucet()
                    await this.createSafe(tokenRequest, signature)
                }

                safe = await this.connectSafe(safe)

                const deviceAddr = await this.localRelayer.getAddress()

                if (await safe.isOwner(deviceAddr)) {
                    // console.log("safe already exists")
                    return safe
                }
                // console.log("getting new token signature")
                const { tokenRequest, signature } = await this.findOrCreateAuthorizationAndCallFaucet()

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
