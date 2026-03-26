import std.sync.Mutex
import std.collection.ArrayList

let messages = ArrayList<String>()
let messagesLock = Mutex()

main(): Int64 {
    let futures = ArrayList<Future<Unit>>()
    
    // Start 5 worker threads
    for (workerId in 1..=5) {
        let current = workerId
        let future = spawn {
            // Perform time-consuming calculations outside critical section
            let message = "Worker ${current} completed task"
            
            // Simulate some computational work
            var sum = 0
            for (i in 0..1000) {
                sum += i
            }
            
            // Only hold lock when accessing shared data
            synchronized(messagesLock) {
                messages.add(message)
            }
        }
        futures.add(future)
    }
    
    // Wait for all threads to complete
    for (future in futures) {
        future.get()
    }
    
    // Print all messages
    println("Received ${messages.size} messages:")
    for (message in messages) {
        println("  - ${message}")
    }
    
    return 0
}