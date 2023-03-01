import { ContractNetworksConfig } from '@safe-global/safe-core-sdk'
import EthersAdapter from '@safe-global/safe-ethers-lib'
import { providers, Signer, ethers, BigNumber } from 'ethers'
import { getBytesAndCreateToken } from './tokenCreator'
import { EnglishOwnerAdder, EnglishOwnerAdder__factory, WalletDeployer, WalletDeployer__factory } from '../typechain-types'
import SimpleSyncher from './singletonQueue'
import Safe from '@safe-global/safe-core-sdk'
// import { Deferrable } from "@ethersproject/properties";
import { GnosisSafeL2__factory } from '../typechain-types'
import { SafeSigner } from './SafeSigner'

// const GnosisSafeInterface = GnosisSafeL2__factory.createInterface()

// enum OperationType {
//     Call, // 0
//     DelegateCall // 1
// }

const KEY_FOR_PRIVATE_KEY = 'safe-relayer-pk'

// const SUCCESS_TOPIC = "0x442e715f626346e8c54381002da614f62bee8d27386535b2521ec8540898556e" // ethers.utils.keccak256('ExecutionSuccess(bytes32,uint256)')

type Address = string

interface LocalStorage {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
}

interface UserRelayerProps {
    ethers: typeof ethers
    walletDeployerAddress: Address
    EnglishOwnerAdderAddress: Address
    networkConfig: ContractNetworksConfig
    provider: providers.Provider
    localStorage: LocalStorage
    faucet: (address: Address) => Promise<void>
}

export class SafeRelayer {
    private config: UserRelayerProps
    private ethAdapter: EthersAdapter
    private walletDeployer: WalletDeployer
    private englishAdder: EnglishOwnerAdder
    private _wrappedSigner?: Signer

    localRelayer: Signer
    singleton: SimpleSyncher
    originalSigner?: Signer
    safe?: Promise<Safe>

    constructor(config: UserRelayerProps) {
        this.config = config
        this.localRelayer = this.findOrCreateLocalRelayer()
        this.walletDeployer = WalletDeployer__factory.connect(config.walletDeployerAddress, this.localRelayer)
        this.englishAdder = EnglishOwnerAdder__factory.connect(config.EnglishOwnerAdderAddress, this.localRelayer)
        this.ethAdapter = new EthersAdapter({
            ethers: ethers,
            signerOrProvider: this.localRelayer,
        })
        this.singleton = new SimpleSyncher("safe-relayer")
    }

    get provider() {
        return this.config.provider
    }

    get localStorage() {
        return this.config.localStorage
    }

    async setSigner(signer: Signer) {
        // this signer is the original signer, we'll use it to approve the safe.
        this.originalSigner = signer
        // first we check to see if it has a safe or not?
        // if it does, we use that safe, otherwise we'll setup a safe.
        // then we'll use that safe to sign future transactions.
        return this.setupSigner()
    }

    wrappedSigner() {
        if (this._wrappedSigner) {
            return this._wrappedSigner
        }
        this._wrappedSigner = new SafeSigner(this)
        return this._wrappedSigner
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
            // const ownerAddr = await this.originalSigner.getAddress()
            const device = await this.localRelayer.getAddress()
            // then we need to create a new safe
            const { tokenRequest, signature } = await getBytesAndCreateToken(this.walletDeployer, this.originalSigner, device)
            const tx = await this.walletDeployer.createSafe(tokenRequest, signature)
            const receipt = await tx.wait()
            return receipt
        } catch (err) {
            console.error("error creating safe: ", err)
            throw err
        }
    }

    private async maybeAddDevice() {
        return this.singleton.push(async () => {
            if (!this.originalSigner) {
                throw new Error('No signer set')
            }
            if (!this.safe) {
                throw new Error("safe mmust be defined")
            }
            try {
                const safe = await this.safe
                const safeAddr = safe.getAddress()
                const device = await this.localRelayer.getAddress()
                if (await safe.isOwner(device)) {
                    return
                }
                // then we need to create a new safe
                const { tokenRequest, signature } = await getBytesAndCreateToken(this.englishAdder, this.originalSigner, device)
                const tx = await this.englishAdder.addOwner(
                    safeAddr,
                    tokenRequest,
                    signature
                )
                return tx.wait()
            } catch (err) {
                console.error("error adding device: ", err)
                throw err
            }
        })
    }

    private async setupSigner() {
        if (!this.originalSigner) {
            throw new Error('No signer set')
        }
        const addr = await this.walletDeployer.ownerToSafe(await this.originalSigner.getAddress())
        this.singleton.push(async () => this.config.faucet(await this.localRelayer.getAddress()))

        if (addr === ethers.constants.AddressZero) {
            this.singleton.push(() => this.createSafe())
        }

        // otherwise we just use the existing safe
        this.safe = this.singleton.push(async () => {
            try {
                if (!this.originalSigner) {
                    throw new Error('No signer set')
                }
                const addr = await this.walletDeployer.ownerToSafe(await this.originalSigner.getAddress())
                const safe = await Safe.create({
                    ethAdapter: this.ethAdapter,
                    safeAddress: addr,
                    contractNetworks: this.config.networkConfig,
                })
                return safe
            } catch (err) {
                console.error("error creating safe: ", err)
                throw err
            }
        })
        return this.maybeAddDevice()
    }
}
