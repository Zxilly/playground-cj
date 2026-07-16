export interface ManagedLanguageClient {
  start: () => Promise<void>
  stop: () => Promise<void>
  dispose: () => Promise<void> | void
}

type ClientFactory<TPort, TClient> = (port: TPort) => Promise<TClient | undefined>

/**
 * Serializes page-wide language-client replacements and applies latest-request
 * wins semantics. A client that finishes starting after its port was superseded
 * is stopped and disposed instead of being published as the current client.
 */
export class LatestLanguageClientController<TPort, TClient extends ManagedLanguageClient> {
  private client: TClient | undefined
  private clientPort: TPort | undefined
  private requestedPort: TPort | undefined
  private requestEpoch = 0
  private startup: Promise<TClient | undefined> | undefined
  private transition: Promise<void> = Promise.resolve()

  adopt(port: TPort, client: TClient): void {
    if (this.client || this.requestedPort !== undefined)
      return
    this.client = client
    this.clientPort = port
    this.requestedPort = port
  }

  ensure(port: TPort, create: ClientFactory<TPort, TClient>): Promise<TClient | undefined> {
    if (this.client && this.clientPort === port && this.requestedPort === port)
      return Promise.resolve(this.client)
    if (this.requestedPort === port && this.startup)
      return this.startup

    const epoch = ++this.requestEpoch
    this.requestedPort = port
    const run = async (): Promise<TClient | undefined> => {
      if (!this.isCurrent(epoch, port))
        return undefined

      if (this.client) {
        const previous = this.client
        this.client = undefined
        this.clientPort = undefined
        await this.disposeClient(previous)
      }
      if (!this.isCurrent(epoch, port))
        return undefined

      const candidate = await create(port)
      if (!candidate)
        return undefined
      if (!this.isCurrent(epoch, port)) {
        await this.disposeClient(candidate)
        return undefined
      }

      try {
        await candidate.start()
      }
      catch (error) {
        await this.disposeClient(candidate)
        throw error
      }
      if (!this.isCurrent(epoch, port)) {
        await this.disposeClient(candidate)
        return undefined
      }

      this.client = candidate
      this.clientPort = port
      return candidate
    }

    const startup = this.transition.then(run, run)
    this.transition = startup.then(
      () => undefined,
      () => undefined,
    )
    this.startup = startup
    void startup.finally(() => {
      if (this.startup === startup)
        this.startup = undefined
    }).catch(() => {})
    return startup
  }

  async dispose(): Promise<void> {
    this.requestEpoch += 1
    this.requestedPort = undefined
    this.startup = undefined
    const run = async () => {
      const client = this.client
      this.client = undefined
      this.clientPort = undefined
      if (client)
        await this.disposeClient(client)
    }
    const disposal = this.transition.then(run, run)
    this.transition = disposal.then(
      () => undefined,
      () => undefined,
    )
    await disposal
  }

  private isCurrent(epoch: number, port: TPort): boolean {
    return this.requestEpoch === epoch && this.requestedPort === port
  }

  private async disposeClient(client: TClient): Promise<void> {
    try {
      await client.stop()
    }
    catch {}
    try {
      await client.dispose()
    }
    catch {}
  }
}
