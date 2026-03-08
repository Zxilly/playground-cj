import std.collection.ArrayList
import std.sync.*

func square(n: Int64): Int64 {
    return n * n
}

main(): Int64 {
    let jobs = [2, 4, 6, 8]
    let results = ArrayList<String>()
    let resultsLock = Mutex()
    let completed = AtomicInt64(0)
    let futures = ArrayList<Future<Unit>>()

    for (job in jobs) {
        let current = job
        let future = spawn {
            let value = square(current)
            synchronized(resultsLock) {
                results.add("${current}^2 = ${value}")
            }
            let _ = completed.fetchAdd(1)
        }
        futures.add(future)
    }

    for (future in futures) {
        future.get()
    }

    println("completed = ${completed.load()}")
    for (line in results) {
        println(line)
    }
    return 0
}
