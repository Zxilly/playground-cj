import std.sync.*
import std.collection.*

var counter: Int64 = 0
let mu = Mutex()

main(): Unit {
    let futures = ArrayList<Future<Unit>>()
    for (_ in 0..10) {
        let f = spawn {=>
            for (_ in 0..100) {
                synchronized(mu) {
                    counter++
                }
            }
        }
        futures.add(f)
    }
    for (f in futures) {
        f.get()
    }
    println("Final count: ${counter}")
}
