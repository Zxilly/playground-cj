func repeat(times!: Int64, action: (Int64) -> Unit) {
    for (i in 0..times) {
        action(i)
    }
}

func runTask(action: () -> Unit) {
    println("Starting task...")
    action()
    println("Task complete.")
}

main() {
    // Trailing lambda syntax
    repeat(times: 3) { i: Int64 =>
        println("Iteration ${i}")
    }

    println("---")

    // Lambda is the only argument - parentheses can be omitted
    runTask { =>
        println("Doing important work!")
    }
}