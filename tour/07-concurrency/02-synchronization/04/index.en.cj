import std.sync.*
import std.collection.ArrayList

// Function to calculate square value
func square(n: Int64): Int64 {
    return n * n
}

main(): Int64 {
    // Define task list
    let jobs = [2, 4, 6, 8, 10]
    
    // Shared data structures
    let results = ArrayList<String>()
    let resultsLock = Mutex()
    let completed = AtomicInt64(0)
    
    // Store all Futures
    let futures = ArrayList<Future<Unit>>()
    
    // Start a thread for each task
    for (job in jobs) {
        let current = job
        let future = spawn {
            // Execute calculation (no synchronization needed)
            let value = square(current)
            
            // Write result to shared list (Mutex required)
            synchronized(resultsLock) {
                results.add("${current}² = ${value}")
            }
            
            // Update completion count (use atomic operation)
            let _ = completed.fetchAdd(1)
        }
        futures.add(future)
    }
    
    // Wait for all threads to complete
    for (future in futures) {
        future.get()
    }
    
    // Output results
    println("Completion count: ${completed.load()}")
    println("Calculation results:")
    for (line in results) {
        println("  ${line}")
    }
    
    return 0
}