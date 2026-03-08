import std.collection.ArrayList
import std.sync.AtomicInt64

let counter = AtomicInt64(0)

main(): Int64 {
    let futures = ArrayList<Future<Unit>>()

    for (_ in 0..20) {
        let future = spawn {
            let _ = counter.fetchAdd(1)
        }
        futures.add(future)
    }

    for (future in futures) {
        future.get()
    }

    println("counter = ${counter.load()}")
    return 0
}
