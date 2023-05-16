import { ethers, Signer, providers } from "ethers"
import { defineReadOnly, Deferrable } from "@ethersproject/properties";
import { GnosisSafeL2, GnosisSafeL2__factory } from '../typechain-types'
import { ProofOfRelayer, SafeRelayer } from "./SafeRelayer";
import { OPERATION } from "./txSigner";
import { safeFromPopulated } from "./GnosisHelpers";

const GnosisSafeInterface = GnosisSafeL2__factory.createInterface()

const SUCCESS_TOPIC = "0x442e715f626346e8c54381002da614f62bee8d27386535b2521ec8540898556e" // ethers.utils.keccak256('ExecutionSuccess(bytes32,uint256)')

export interface SafeSignerOptions {}

/**
 * SafeSigner is a subclass of ethers.Signer that uses a SafeRelayer to sign and send transactions.
 */
export class SafeSigner extends Signer {
    readonly provider?: providers.Provider
    readonly relayer: SafeRelayer

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

    safeAddress(): Promise<string|undefined> {
        return this.relayer.predictedSafeAddress()
    }

    proofOfRelayer(): Promise<ProofOfRelayer> {
        return this.relayer.proofOfRelayer()
    }

    waitForSafe(): Promise<GnosisSafeL2> {
        return this.relayer.safe
    }

    async signMessage(message: string | Uint8Array): Promise<string> {
        return this.relayer.localRelayer!.signMessage(message)
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

                const safeContract = GnosisSafeL2__factory.connect((await this.relayer.predictedSafeAddress())!, this.relayer.localRelayer)
                
                const nonce = await safeContract.nonce()

                const [txData] = await safeFromPopulated(
                    safeContract,
                    nonce,
                    this.relayer.localRelayer,
                    populated.to!,
                    populated.data!,
                    OPERATION.CALL,
                    {
                        gasLimit: 3_000_000
                    }
                )

                const tx = await this.relayer.localRelayer.sendTransaction(txData)
                
                const originalWait = tx.wait
                tx.wait = async (confirmations?: number): Promise<ethers.ContractReceipt> => {
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

                return tx
            } catch (err) {
                // console.error("error creating transaction: ", err)
                throw err
            }
        })
    }
}
