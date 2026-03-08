import std.collection.ArrayList
import std.sync.Mutex

let messages = ArrayList<String>()
let messagesLock = Mutex()

main(): Int64 {
    let futures = ArrayList<Future<Unit>>()

    for (workerId in 1..4) {
        let current = workerId
        let future = spawn {
            let message = "worker ${current} finished"
            synchronized(messagesLock) {
                messages.add(message)
            }
        }
        futures.add(future)
    }

    for (future in futures) {
        future.get()
    }

    for (message in messages) {
        println(message)
    }
    return 0
}
