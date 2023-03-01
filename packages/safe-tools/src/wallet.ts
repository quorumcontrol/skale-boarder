import { ContractNetworksConfig } from '@safe-global/safe-core-sdk'
import EthersAdapter from '@safe-global/safe-ethers-lib'
import { providers, Signer, ethers, BigNumber } from 'ethers'
import { getBytesAndCreateToken } from './tokenCreator'
import { WalletDeployer, WalletDeployer__factory } from '../typechain-types'
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
    networkConfig: ContractNetworksConfig
    provider: providers.Provider
    localStorage: LocalStorage
    faucet: (address: Address) => Promise<void>
}

export class SafeRelayer {
    private config: UserRelayerProps
    private ethAdapter: EthersAdapter
    originalSigner?: Signer
    private walletDeployer: WalletDeployer
    localRelayer: Signer
    singleton: SimpleSyncher

    safe?: Promise<Safe>

    private _wrappedSigner?: Signer

    constructor(config: UserRelayerProps) {
        this.config = config
        this.localRelayer = this.findOrCreateLocalRelayer()
        this.walletDeployer = WalletDeployer__factory.connect(config.walletDeployerAddress, this.localRelayer)
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

    // async sendTransaction(transaction: Deferrable<TransactionRequest>): Promise<TransactionResponse> {
    //     this._checkProvider("sendTransaction");
    //     const tx = await this.populateTransaction(transaction);
    //     const signedTx = await this.signTransaction(tx);
    //     return await this.provider.sendTransaction(signedTx);
    // }

    wrappedSigner() {
        if (this._wrappedSigner) {
            return this._wrappedSigner
        }
        this._wrappedSigner = new SafeSigner(this)
        return this._wrappedSigner
        // const handler = {
        //     get: (originalSigner: Signer, prop: string, _receiver: Signer) => {
        //         //TODO: do we need to support other methods like getBalance, etc?
        //         switch (prop) {
        //             case "signTransaction":
        //                 console.log("sign transaction called")
        //                 return originalSigner.signTransaction.bind(originalSigner)
        //             case "estimateGas":
        //                 return async (transaction: Deferrable<providers.TransactionRequest>) => {
        //                     return this.provider.estimateGas(transaction)
        //                 }
        //             case "call":
        //                 return async (transaction: Deferrable<providers.TransactionRequest>) => {
        //                     return this.provider.call(transaction)
        //                 }
        //             case "sendTransaction":
        //                 return async (transaction: Deferrable<providers.TransactionRequest>) => {
        //                     console.log("send transaction")
        //                     return this.singleton.push(async () => {
        //                         if (!this.safe) {
        //                             throw new Error('No safe set')
        //                         }
        //                         try {
        //                             const populated = await originalSigner.populateTransaction(transaction)
        //                             const safe = await this.safe
        //                             const tx = await safe.createTransaction({
        //                                 safeTransactionData: {
        //                                     to: populated.to!,
        //                                     value: populated.value?.toString() || "0x0",
        //                                     data: populated.data?.toString() || '0x',
        //                                     operation: OperationType.Call,
        //                                 },
        //                                 options: {
        //                                     safeTxGas: populated.gasLimit ? BigNumber.from(populated.gasLimit).toNumber() : undefined,
        //                                     gasPrice: populated.gasPrice ? BigNumber.from(populated.gasPrice).toNumber() : undefined,
        //                                 }
        //                             })
        //                             const signed = await safe.signTransaction(tx)
        //                             const executionResponse = await safe.executeTransaction(signed)
        //                             const transactionResponse = executionResponse.transactionResponse
        //                             if (!transactionResponse) {
        //                                 throw new Error("no transaction response")
        //                             }
        //                             const originalWait = transactionResponse.wait
        //                             transactionResponse.wait = async (confirmations?: number): Promise<ethers.ContractReceipt> => {
        //                                 const receipt = await originalWait(confirmations)

        //                                 // purposely *removing* the SUCCESS_TOPIC so that the transaction looks *just* like a normal transaction
        //                                 const lastLog = receipt.logs.pop()
        //                                 if (lastLog?.topics[0] === SUCCESS_TOPIC) {
        //                                     // we filter out any logs belonging to the proxy itself
        //                                     receipt.logs = receipt.logs.filter((l) => {
        //                                         try {
        //                                             GnosisSafeInterface.parseLog(l)
        //                                             return false
        //                                         } catch {
        //                                             return true
        //                                         }
        //                                     })
        //                                     return receipt
        //                                 }
        //                                 throw new Error("transaction failed")
        //                             }

        //                             return transactionResponse
        //                         } catch (err) {
        //                             // console.error("error creating transaction: ", err)
        //                             throw err
        //                         }
        //                     })
        //                 }
        //             default:
        //                 const original = (originalSigner as any)[prop]
        //                 console.log("originalSigner prop: ", prop, original)
        //                 if (typeof original === "function") {
        //                     return (...args: any[]) => {
        //                         return original.apply(originalSigner, args)
        //                     }
        //                 }
        //                 return original
        //         }
        //     }
        // }
        // this._wrappedSigner = new Proxy(this.originalSigner!, handler)
        // return this._wrappedSigner
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
    }
}
