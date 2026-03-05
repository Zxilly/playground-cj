import std.sync.*
import std.collection.*

main() {
    let mutex = ReentrantMutex()
    var counter = 0

    let futures = ArrayList<Future<Unit>>()

    // Spawn 10 threads, each incrementing counter 100 times
    var t = 0
    while (t < 10) {
        let f = spawn {
            var i = 0
            while (i < 100) {
                mutex.lock()
                counter += 1
                mutex.unlock()
                i += 1
            }
        }
        futures.append(f)
        t += 1
    }

    // Wait for all threads
    for (f in futures) {
        f.get()
    }

    println("Expected: 1000")
    println("Actual:   ${counter}")
}