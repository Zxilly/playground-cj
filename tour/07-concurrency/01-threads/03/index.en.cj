import std.sync.SyncCounter

main() {
    // Create a counter as a "gate" with initial value 1
    let gate = SyncCounter(1)

    // Create a worker thread
    let worker = spawn {
        println("worker: waiting for gate to open")
        gate.waitUntilZero()  // Block until counter reaches zero

        // Check if there's a cancellation request
        if (Thread.currentThread.hasPendingCancellation) {
            println("worker: received cancellation request, exiting early")
            return
        }

        println("worker: continuing with task")
    }

    // First send the cancellation request
    println("Main thread: sending cancellation request")
    worker.cancel()

    // Then open the gate (decrement counter by 1)
    println("Main thread: opening gate")
    gate.dec()

    // Wait for worker thread to finish
    worker.get()
    println("Main thread: done")
}