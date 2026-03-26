import std.sync.Mutex
import std.collection.ArrayList

var count: Int64 = 0
let mtx = Mutex()

main(): Int64 {
    let futures = ArrayList<Future<Unit>>()
    
    // Create 20 concurrent threads
    for (_ in 0..20) {
        let future = spawn {
            synchronized(mtx) {
                count += 1
            }
        }
        futures.add(future)
    }
    
    // Wait for all threads to complete
    for (future in futures) {
        future.get()
    }
    
    println("Final count: ${count}")
    return 0
}