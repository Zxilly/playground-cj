import std.sync.*
import std.collection.*

main() {
    let counter = AtomicInt64(0)

    let futures = ArrayList<Future<Unit>>()

    // Spawn 10 threads, each incrementing 100 times
    var t = 0
    while (t < 10) {
        let f = spawn {
            var i = 0
            while (i < 100) {
                counter.fetchAdd(1)
                i += 1
            }
        }
        futures.append(f)
        t += 1
    }

    for (f in futures) {
        f.get()
    }

    println("Atomic counter result: ${counter.load()}")
    println("Expected: 1000")
}