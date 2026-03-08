import std.collection.ArrayList
import std.sync.*

func double(n: Int64): Int64 {
    return n * 2
}

main(): Int64 {
    let inputs = [3, 5, 8]
    let outputs = ArrayList<String>()
    let lock = Mutex()
    let futures = ArrayList<Future<Unit>>()

    for (input in inputs) {
        let current = input
        let future = spawn {
            let result = double(current)
            synchronized(lock) {
                outputs.add("${current} -> ${result}")
            }
        }
        futures.add(future)
    }

    for (future in futures) {
        future.get()
    }

    println("tour recap:")
    for (line in outputs) {
        println(line)
    }
    return 0
}
