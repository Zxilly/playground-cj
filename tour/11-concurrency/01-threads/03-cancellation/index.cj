main() {
    let f = spawn {
        var count = 0
        while (count < 100) {
            // Check if cancellation has been requested
            if (Thread.currentThread.hasPendingCancellation) {
                println("Thread cancelled after ${count} iterations")
                return count
            }
            count += 1
        }
        println("Thread completed all iterations")
        count
    }

    // Let the thread run briefly, then cancel
    // The thread may complete some iterations before seeing the cancel
    f.cancel()

    let result = f.get()
    println("Thread result: ${result}")
    println("Main thread done")
}