// A comprehensive example: Mini task scheduler
import std.sync.*
import std.collection.*

interface Task {
    func name(): String
    func execute(): String
}

class FibonacciTask <: Task {
    let n: Int64

    init(n: Int64) {
        this.n = n
    }

    func name(): String { return "Fibonacci(${this.n})" }

    func execute(): String {
        func fib(x: Int64): Int64 {
            if (x <= 1) { return x }
            return fib(x - 1) + fib(x - 2)
        }
        return "${fib(this.n)}"
    }
}

class FactorialTask <: Task {
    let n: Int64

    init(n: Int64) {
        this.n = n
    }

    func name(): String { return "Factorial(${this.n})" }

    func execute(): String {
        var result: Int64 = 1
        var i: Int64 = 2
        while (i <= this.n) {
            result *= i
            i += 1
        }
        return "${result}"
    }
}

main() {
    let tasks = ArrayList<Task>()
    tasks.append(FibonacciTask(10))
    tasks.append(FactorialTask(8))
    tasks.append(FibonacciTask(15))
    tasks.append(FactorialTask(10))
    tasks.append(FibonacciTask(20))

    let mutex = ReentrantMutex()
    let results = ArrayList<String>()
    let completed = AtomicInt64(0)

    println("Scheduling ${tasks.size} tasks...")

    let futures = ArrayList<Future<Unit>>()
    for (task in tasks) {
        let t = task
        let f = spawn {
            let result = t.execute()
            mutex.lock()
            results.append("${t.name()} = ${result}")
            mutex.unlock()
            completed.fetchAdd(1)
        }
        futures.append(f)
    }

    for (f in futures) {
        f.get()
    }

    println("Completed ${completed.load()} tasks:")
    for (r in results) {
        println("  ${r}")
    }
}