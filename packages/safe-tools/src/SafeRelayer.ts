import { providers, Signer, ethers, BytesLike } from 'ethers'
import { getBytesAndCreateToken, TokenRequest } from './tokenCreator'
import { EnglishOwnerAdder, EnglishOwnerAdder__factory, GnosisSafeL2, WalletDeployer, WalletDeployer__factory } from '../typechain-types'
import SimpleSyncher from './SimpleSyncher'
import { SafeSigner } from './SafeSigner'
import addresses from './addresses'
import { GnosisSafeL2__factory } from '../typechain-types/factories/gnosis-safe-artifacts/contracts'
import { safeAddress } from './GnosisHelpers'

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

    // networkConfig: ContractNetworksConfig
    provider: providers.Provider
    faucet: (address: Address, signer?:Signer) => Promise<void>
    localStorage?: LocalStorage
    walletDeployerAddress?: Address
    EnglishOwnerAdderAddress?: Address
    setupHandlerAddress?: Address
}

export class SafeRelayer {
    private config: UserRelayerProps
    // private ethAdapter: EthersAdapter
    private walletDeployer: WalletDeployer
    private englishAdder: EnglishOwnerAdder
    private _wrappedSigner?: SafeSigner

    private localStorage: LocalStorage

    private authorization?: Promise<{ tokenRequest: TokenRequest, signature: BytesLike}>

    private faucetCalled = false

    localRelayer: Signer
    singleton: SimpleSyncher
    originalSigner?: Signer

    // this is setup with setupSigner
    safe!: Promise<GnosisSafeL2>

    constructor(config: UserRelayerProps) {
        this.config = config
        this.localStorage = this.findDefaultLocalStorage()

        this.localRelayer = this.findOrCreateLocalRelayer()
        this.walletDeployer = WalletDeployer__factory.connect(config.walletDeployerAddress || addresses.WalletDeployer, this.localRelayer)
        this.englishAdder = EnglishOwnerAdder__factory.connect(config.EnglishOwnerAdderAddress || addresses.WalletDeployer, this.localRelayer)
        // this.ethAdapter = new EthersAdapter({
        //     ethers: ethers,
        //     signerOrProvider: this.localRelayer,
        // })
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

    async proofOfRelayer():Promise<ProofOfRelayer> {
        const proof = {
          address: await this.localRelayer.getAddress(),
          chainId: await this.localRelayer.getChainId(),
          exp: Math.ceil(new Date().getTime() / 1000) + (10 * 60) // 10 minutes
        }
      
        const relayerSignature = await this.localRelayer.signMessage(JSON.stringify(proof))

        const safeAddr = await this.predictedSafeAddress()
        if (!safeAddr) {
            throw new Error("missing even predicted address")
        }
        const isDeployed = await this.isDeployed(safeAddr)

        const safe = GnosisSafeL2__factory.connect(safeAddr, this.provider)
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

    async predictedSafeAddress() {
        if (!this.originalSigner) {
            return undefined
        }

        const [originalAddress, chainId] = await Promise.all([
            this.originalSigner.getAddress(),
            this.localRelayer.getChainId()
        ])

        return safeAddress(originalAddress, chainId)
    }

    private async createSafe(tokenRequest: TokenRequest, signature: BytesLike) {
        if (!this.originalSigner) {
            throw new Error('No signer set')
        }
        try {
            const tx = await this.walletDeployer.createSafe(tokenRequest, signature, this.englishAdder.address, [])
            
            return tx.wait()
        } catch (err) {
            console.error("error creating safe: ", err)
            throw err
        }
    }

    private async addDevice(safe: GnosisSafeL2, tokenRequest: TokenRequest, signature: BytesLike) {
        try {
            if (!this.originalSigner) {
                throw new Error('No signer set')
            }
            const tx = await this.englishAdder.addOwner(
                safe.address,
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

    // TODO: look to see if this has expired
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


    private async isDeployed(safeAddr: Address) {
        return (await this.provider.getCode(safeAddr)) !== '0x'
    }

    private setupSignerAndFindOrCreateSafe(signer:Signer) {
        this.originalSigner = signer
        this.safe = this.singleton.push(async () => {
            try {
                if (!this.originalSigner) {
                    throw new Error('No signer set')
                }
                
                const safe = GnosisSafeL2__factory.connect((await this.predictedSafeAddress())!, this.localRelayer)
                const isDeployed = await this.isDeployed(safe.address)

                if (!isDeployed) {
                    const { tokenRequest, signature } = await this.findOrCreateAuthorizationAndCallFaucet()
                    await this.createSafe(tokenRequest, signature)
                }

                // safe = await this.connectSafe(safe)

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
