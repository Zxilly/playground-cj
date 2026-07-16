export interface LanguageServiceLifecycleDeps {
  start: () => Promise<void>
  disposeClient: () => Promise<void>
  stop: () => Promise<void>
}

/** Reference-counts editor consumers around a shared language-service runtime. */
export class LanguageServiceLeaseManager {
  private consumers = 0
  private active = false
  private reconcileEpoch = 0
  private operation: Promise<void> = Promise.resolve()

  constructor(private readonly deps: LanguageServiceLifecycleDeps) {}

  acquire(): () => Promise<void> {
    this.consumers += 1
    void this.reconcile()
    let released = false
    return async () => {
      if (released)
        return
      released = true
      this.consumers = Math.max(0, this.consumers - 1)
      await this.reconcile()
    }
  }

  settled(): Promise<void> {
    return this.operation
  }

  markStarted(): void {
    this.active = true
  }

  markStopped(): void {
    this.active = false
  }

  private reconcile(): Promise<void> {
    const epoch = ++this.reconcileEpoch
    const run = async () => {
      if (epoch !== this.reconcileEpoch)
        return
      if (this.consumers > 0) {
        if (this.active)
          return
        await this.deps.start()
        this.active = true
        return
      }
      if (!this.active)
        return
      await this.deps.disposeClient()
      if (epoch === this.reconcileEpoch && this.consumers === 0) {
        await this.deps.stop()
        this.active = false
      }
      else {
        // The client was disposed, so a newly queued consumer must reconcile
        // even when the low-level server remained alive during the hand-off.
        this.active = false
      }
    }
    const next = this.operation.then(run, run)
    this.operation = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }
}
