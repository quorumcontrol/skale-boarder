import { ethers, BigNumber, Signer, providers } from "ethers"
import { defineReadOnly, Deferrable } from "@ethersproject/properties";
import { GnosisSafeL2__factory } from '../typechain-types'
import { SafeRelayer } from "./wallet";

const GnosisSafeInterface = GnosisSafeL2__factory.createInterface()

enum OperationType {
    Call, // 0
    DelegateCall // 1
}

// const KEY_FOR_PRIVATE_KEY = 'safe-relayer-pk'

const SUCCESS_TOPIC = "0x442e715f626346e8c54381002da614f62bee8d27386535b2521ec8540898556e" // ethers.utils.keccak256('ExecutionSuccess(bytes32,uint256)')

export class SafeSigner extends Signer {
    readonly provider?: providers.Provider
    private relayer: SafeRelayer

    constructor(relayer: SafeRelayer) {
        super();
        this.relayer = relayer;
        defineReadOnly(this, "provider", relayer.provider);
    }

    connect(_provider: providers.Provider): SafeSigner {
        throw new Error("unsupported")
    }

    getAddress(): Promise<string> {
        return this.relayer.originalSigner!.getAddress()
    }

    async signMessage(message: string | Uint8Array): Promise<string> {
        return this.relayer.originalSigner!.signMessage(message)
    }

    async signTransaction(transaction: Deferrable<providers.TransactionRequest>): Promise<string> {
        return this.relayer.localRelayer.signTransaction(transaction)
    }

    async estimateGas(transaction: Deferrable<providers.TransactionRequest>) {
        return this.provider!.estimateGas(transaction)
    }

    async call(transaction: Deferrable<providers.TransactionRequest>) {
        return this.provider!.call(transaction)
    }

    async sendTransaction(transaction: Deferrable<providers.TransactionRequest>) {
        // console.log("send transaction", transaction.nonce)
        return this.relayer.singleton.push(async () => {
            if (!this.relayer.safe) {
                console.error("no safe yet")
                throw new Error('No safe set')
            }
            try {
                // console.log("populating")
                
                // we want to populate the transaction from the perspective of the local relayer because
                // the original signer is on a different network and may or may not fail on estimateGas when 
                // the transaction will fail.
                transaction.from = await this.relayer.localRelayer.getAddress()
                const populated = await this.relayer.localRelayer.populateTransaction(transaction)
                // console.log("executing transaction", populated.nonce)
                const safe = await this.relayer.safe
                const tx = await safe.createTransaction({
                    safeTransactionData: {
                        to: populated.to!,
                        value: populated.value?.toString() || "0x0",
                        data: populated.data?.toString() || '0x',
                        operation: OperationType.Call,
                    },
                    options: {
                        safeTxGas: populated.gasLimit ? BigNumber.from(populated.gasLimit).toNumber() : undefined,
                        gasPrice: populated.gasPrice ? BigNumber.from(populated.gasPrice).toNumber() : undefined,
                    }
                })
                const signed = await safe.signTransaction(tx)
                const executionResponse = await safe.executeTransaction(signed)
                const transactionResponse = executionResponse.transactionResponse
                if (!transactionResponse) {
                    throw new Error("no transaction response")
                }
                const originalWait = transactionResponse.wait
                transactionResponse.wait = async (confirmations?: number): Promise<ethers.ContractReceipt> => {
                    const receipt = await originalWait(confirmations)

                    // purposely *removing* the SUCCESS_TOPIC so that the transaction looks *just* like a normal transaction
                    const lastLog = receipt.logs.pop()
                    if (lastLog?.topics[0] === SUCCESS_TOPIC) {
                        // we filter out any logs belonging to the proxy itself
                        receipt.logs = receipt.logs.filter((l) => {
                            try {
                                GnosisSafeInterface.parseLog(l)
                                return false
                            } catch {
                                return true
                            }
                        })
                        return receipt
                    }
                    throw new Error("transaction failed")
                }

                return transactionResponse
            } catch (err) {
                // console.error("error creating transaction: ", err)
                throw err
            }
        })
    }
}
