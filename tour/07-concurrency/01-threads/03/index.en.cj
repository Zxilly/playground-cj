import std.sync.SyncCounter

main(): Unit {
    let gate = SyncCounter(1)

    let worker = spawn {
        println("worker: waiting")
        gate.waitUntilZero()

        if (Thread.currentThread.hasPendingCancellation) {
            println("worker: cancelled")
            return
        }

        println("worker: running")
    }

    worker.cancel()
    gate.dec()
    worker.get()
}
