import std.sync.AtomicInt64
import std.collection.ArrayList

let counter = AtomicInt64(0)

main(): Int64 {
    let futures = ArrayList<Future<Unit>>()
    
    // Create 50 concurrent threads, each incrementing the counter
    for (_ in 0..50) {
        let future = spawn {
            let oldValue = counter.fetchAdd(1)
            println("Before increment: ${oldValue}")
        }
        futures.add(future)
    }
    
    // Wait for all threads to complete
    for (future in futures) {
        future.get()
    }
    
    println("Final count: ${counter.load()}")
    return 0
}