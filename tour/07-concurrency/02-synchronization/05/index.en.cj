import std.sync.Mutex
import std.collection.ArrayList

var counter: Int64 = 0
let mu = Mutex()

main(): Int64 {
    let futures = ArrayList<Future<Unit>>()
    
    // Start 10 threads, each incrementing 100 times
    for (_ in 0..10) {
        let future = spawn {
            for (_ in 0..100) {
                // TODO: Add synchronization code here
                // Hint: Use synchronized(mu) to protect counter++
                counter++
            }
        }
        futures.add(future)
    }
    
    // Wait for all threads to complete
    for (future in futures) {
        future.get()
    }
    
    println("Final count: ${counter}")
    println("Expected: 1000")
    
    return 0
}