main() {
    println("Main thread: starting")

    // Create the first worker thread
    let worker1 = spawn {
        println("worker 1: hello")
    }

    // Create the second worker thread
    let worker2 = spawn {
        println("worker 2: hello")
    }

    println("Main thread: waiting for child threads to finish")

    // Wait for both worker threads to finish
    worker1.get()
    worker2.get()

    println("Main thread: done")
}