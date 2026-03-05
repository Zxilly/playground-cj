import std.sync.*
import std.collection.*

func fibonacci(n: Int64): Int64 {
    if (n <= 1) {
        return n
    }
    return fibonacci(n - 1) + fibonacci(n - 2)
}

func factorial(n: Int64): Int64 {
    if (n <= 1) {
        return 1
    }
    return n * factorial(n - 1)
}

main() {
    let mutex = ReentrantMutex()
    let completed = AtomicInt64(0)
    let results = ArrayList<String>()

    println("Starting parallel computations...")

    // Task 1: Compute Fibonacci numbers
    let f1 = spawn {
        var i = 0
        while (i < 8) {
            let result = fibonacci(i)
            mutex.lock()
            results.append("fib(${i}) = ${result}")
            mutex.unlock()
            completed.fetchAdd(1)
            i += 1
        }
    }

    // Task 2: Compute factorials
    let f2 = spawn {
        var i = 1
        while (i <= 8) {
            let result = factorial(i)
            mutex.lock()
            results.append("${i}! = ${result}")
            mutex.unlock()
            completed.fetchAdd(1)
            i += 1
        }
    }

    // Task 3: Compute squares
    let f3 = spawn {
        var i = 1
        while (i <= 8) {
            mutex.lock()
            results.append("${i}^2 = ${i * i}")
            mutex.unlock()
            completed.fetchAdd(1)
            i += 1
        }
    }

    // Wait for all tasks
    f1.get()
    f2.get()
    f3.get()

    println("All tasks done! Completed ${completed.load()} computations.")
    println("Results:")
    for (r in results) {
        println("  ${r}")
    }
}