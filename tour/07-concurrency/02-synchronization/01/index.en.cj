import std.collection.ArrayList
import std.sync.Mutex

let mtx = Mutex()
var count: Int64 = 0

main(): Int64 {
    let futures = ArrayList<Future<Unit>>()

    for (_ in 0..20) {
        let future = spawn {
            synchronized(mtx) {
                count += 1
            }
        }
        futures.add(future)
    }

    for (future in futures) {
        future.get()
    }

    println("count = ${count}")
    return 0
}
