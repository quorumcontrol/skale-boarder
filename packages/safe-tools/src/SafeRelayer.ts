import { providers, Signer, ethers, BigNumber, constants, BytesLike, utils, VoidSigner } from 'ethers'
import { getBytesAndCreateToken, TokenRequest } from './tokenCreator'
import { EnglishOwnerAdder, EnglishOwnerAdder__factory, GnosisSafeL2, GnosisSafeProxyFactory__factory, WalletDeployer, WalletDeployer__factory } from '../typechain-types'
import SimpleSyncher from './SimpleSyncher'
// import Safe, { EthersAdapter, ContractNetworksConfig, PredictedSafeProps } from '@safe-global/protocol-kit'
import { SafeSigner, SafeSignerOptions } from './SafeSigner'
import addresses from './addresses'
import { GnosisSafeL2__factory, GnosisSafe__factory } from '../typechain-types/factories/gnosis-safe-artifacts/contracts'

const KEY_FOR_PRIVATE_KEY = 'safe-relayer-pk'

// saves a call to GnosisSafeProxyFactory#proxyCreationCode()
const proxyCreationCode = "0x608060405234801561001057600080fd5b506040516101e63803806101e68339818101604052602081101561003357600080fd5b8101908080519060200190929190505050600073ffffffffffffffffffffffffffffffffffffffff168173ffffffffffffffffffffffffffffffffffffffff1614156100ca576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260228152602001806101c46022913960400191505060405180910390fd5b806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505060ab806101196000396000f3fe608060405273ffffffffffffffffffffffffffffffffffffffff600054167fa619486e0000000000000000000000000000000000000000000000000000000060003514156050578060005260206000f35b3660008037600080366000845af43d6000803e60008114156070573d6000fd5b3d6000f3fea2646970667358221220d1429297349653a4918076d650332de1a1068c5f3e07c5c82360c277770b955264736f6c63430007060033496e76616c69642073696e676c65746f6e20616464726573732070726f7669646564"

// this is the signature of "setup()"
const setupFunctionEncoded = "0xba0bba40"

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

    private setupHandlerAddress: Address
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

    async isDeployed() {
        const addr = await this.predictedSafeAddress()
        if (!addr) {
            return false
        }
        return (await this.provider.getCode(addr)) !== '0x'
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
        const isDeployed = await this.isDeployed()

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

    // private async predictedSafe() {
    //     if (!this.originalSigner) {
    //         throw new Error("called predictedSafe before a signer was setup")
    //     }
    //     const props:PredictedSafeProps = {
    //         safeAccountConfig: {
    //             owners: [await this.originalSigner.getAddress()],
    //             threshold: 1,
    //             to: this.setupHandlerAddress.toLowerCase(),
    //             data: setupFunctionEncoded,
    //             fallbackHandler: addresses.CompatibilityFallbackHandler,
    //             payment: 0,
    //             paymentReceiver: constants.AddressZero,
    //             paymentToken: constants.AddressZero,
    //         },
    //         safeDeploymentConfig: {
    //             safeVersion: '1.3.0',
    //             saltNonce: BigNumber.from(await this.localRelayer.getChainId()).toHexString(),
    //         }
    //     }

    //     return Safe.create({
    //         ethAdapter: this.ethAdapter,
    //         predictedSafe: props,
    //         contractNetworks: this.config.networkConfig,
    //     })
    // }

    async predictedSafeAddress() {
        if (!this.originalSigner) {
            return undefined
        }

        const originalAddress = await this.originalSigner.getAddress()
        const chainId = await this.localRelayer.getChainId()

        const voidMasterCopy = GnosisSafeL2__factory.connect(constants.AddressZero, new VoidSigner(""))

        async function setupDataForUser(user:Address) {
            const setupData = await voidMasterCopy.populateTransaction.setup([user], 1, addresses.SafeSetup, setupFunctionEncoded, addresses.CompatibilityFallbackHandler, constants.AddressZero, 0, constants.AddressZero)
            if (!setupData.data) {
                throw new Error("no setup data")
            }
            return setupData.data
          }

        const proxyFactory = GnosisSafeProxyFactory__factory.connect(addresses.GnosisSafeProxyFactory, this.provider)

        const setupData = await setupDataForUser(originalAddress)

        const salt = utils.keccak256(utils.solidityPack(['bytes', 'uint256'], [utils.keccak256(setupData), chainId]))
        const initCode = utils.solidityKeccak256(['bytes', 'bytes'], [proxyCreationCode, utils.defaultAbiCoder.encode(['address'], [addresses.GnosisSafe])])
        
        const addr = utils.getCreate2Address(proxyFactory.address, salt, initCode)
        return addr

        // const safe = await this.predictedSafe()
        // return safe.getAddress()
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

    // private async connectSafe(safe:Safe):Promise<Safe> {
    //     return safe.connect({
    //         ethAdapter: this.ethAdapter,
    //         safeAddress: await safe.getAddress(),
    //         contractNetworks: this.config.networkConfig,
    //     })
    // }

    private setupSignerAndFindOrCreateSafe(signer:Signer) {
        this.originalSigner = signer
        this.safe = this.singleton.push(async () => {
            try {
                if (!this.originalSigner) {
                    throw new Error('No signer set')
                }
                
                const safe = await GnosisSafeL2__factory.connect((await this.predictedSafeAddress())!, this.localRelayer)
                const isDeployed = await this.isDeployed()

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
