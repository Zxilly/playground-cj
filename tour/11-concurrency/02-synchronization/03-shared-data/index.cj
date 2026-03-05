import std.sync.*
import std.collection.*

main() {
    let mutex = ReentrantMutex()
    let results = ArrayList<String>()

    let workers = ArrayList<Future<Unit>>()

    var id = 1
    while (id <= 5) {
        let workerId = id
        let f = spawn {
            // Simulate some work
            let result = "Worker ${workerId}: computed ${workerId * workerId}"

            // Safely add to shared list
            mutex.lock()
            results.append(result)
            mutex.unlock()
        }
        workers.append(f)
        id += 1
    }

    // Wait for all workers
    for (f in workers) {
        f.get()
    }

    // Print all results
    println("Results collected from ${results.size} workers:")
    for (r in results) {
        println("  ${r}")
    }
}