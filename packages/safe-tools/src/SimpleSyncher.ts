interface queuedFunction {
  fn: Function
  res: Function
  rej: Function
}

/**
 * SimpleSyncher is used to serialize function calls, it is a single threaded
 * actor that does one function after the next. Every send returns a promise
 * that resolves when the function is executed.
 */
export class SimpleSyncher {
  private queue: queuedFunction[]
  private started: boolean
  private name?: string
  constructor(name?: string) {
    this.started = false
    this.queue = []
    this.name = name
  }

  private async run() {
    const queuedFn = this.queue.shift()
    if (queuedFn === undefined) {
      this.started = false
      return
    }
    try {
      const resp = await queuedFn.fn()
      queuedFn.res(resp)
    } catch (err) {
      queuedFn.rej(err)
    }
    if (this.queue.length > 0) {
      this.run()
    } else {
      this.started = false
    }
  }

  push<T>(fn:()=>Promise<T>):Promise<T> {
    const p = new Promise<T>((resolve, reject) => {
      this.queue.push({
        fn: fn,
        res: resolve,
        rej: reject,
      })
      if (!this.started) {
        this.started = true
        this.run()
        return
      }
    })

    return p
  }
}

export default SimpleSyncher
