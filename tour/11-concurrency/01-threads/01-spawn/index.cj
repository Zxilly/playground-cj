main() {
    println("Main thread starts")

    // Create a single thread
    let f1 = spawn {
        println("Hello from thread 1!")
    }

    let f2 = spawn {
        println("Hello from thread 2!")
    }

    let f3 = spawn {
        println("Hello from thread 3!")
    }

    // Wait for all threads to complete
    f1.get()
    f2.get()
    f3.get()

    println("All threads completed!")
}