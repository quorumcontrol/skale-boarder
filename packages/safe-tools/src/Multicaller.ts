import { BytesLike, PopulatedTransaction, providers } from "ethers"
import debounce from "lodash/debounce"
import { Multicall3, Multicall3__factory } from "../typechain-types"
import { Deferrable } from "ethers/lib/utils"

const SKALE_MULTICALL_3_ADDRESS = "0x15250E1456243f59397e56E663ACe82eD762Fd12"

// interface Call {
//   to: string
//   data: BytesLike
// }

type Call = Deferrable<providers.TransactionRequest>

export interface MultiCallerOptions {
  multicallAddress?: string
  delay?: number
}

interface QueuedCall extends Call {
  resolve: Function
  reject: Function
}


export class MultiCaller {
  multicallAddress: string
  provider: providers.Provider
  delay: number

  multicall:Multicall3

  queuedCalls:QueuedCall[]

  constructor(signerOrProvider: providers.Provider, opts:MultiCallerOptions = {}) {
    this.multicallAddress = opts.multicallAddress || SKALE_MULTICALL_3_ADDRESS
    this.delay = opts.delay || 50
    this.provider = signerOrProvider

    this.multicall = Multicall3__factory.connect(this.multicallAddress, this.provider)
    this.queuedCalls = []

    this.perform = debounce(this.perform.bind(this), this.delay) as () => Promise<void>
  }

  async call<T>(call:Call):Promise<T> {
    return new Promise((resolve, reject) => {
      this.queuedCalls.push({ ...call, resolve, reject })
      this.perform()
    })
  }

  // TODO: split this into windows depending on the maximum data size of the tryAggregate
  private async perform():Promise<void> {
    if (this.queuedCalls.length === 0) return
    const _queuedCalls = [...this.queuedCalls]
    this.queuedCalls = []

    // console.log("performing multicall", _queuedCalls.length)

    const multicalls:Multicall3.CallStruct[] = await Promise.all(_queuedCalls.map(async (call) => {
      const to = await call.to
      const data = await call.data

      return { target: to || "", callData: data || "" }
    }))

    const resp = await this.multicall.callStatic.tryAggregate(false, multicalls)

    resp.forEach((result, i) => {
      const call = _queuedCalls[i]
      if (result.success) {
        call.resolve(result.returnData)
      } else {
        call.reject(result.returnData)
      }
    })
  }
}
