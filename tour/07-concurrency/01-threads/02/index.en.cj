// Calculate the sum of all integers in the [start, end] range
func sumRange(start: Int64, end: Int64): Int64 {
    var total: Int64 = 0
    var current = start
    while (current <= end) {
        total += current
        current += 1
    }
    return total
}

main() {
    println("Calculating sum from 1 to 100...")

    // Calculate the first half in a new thread
    let left = spawn {
        sumRange(1, 50)
    }

    // Calculate the second half in another new thread
    let right = spawn {
        sumRange(51, 100)
    }

    // Wait for both threads to finish and get results
    let leftSum = left.get()
    let rightSum = right.get()
    let total = leftSum + rightSum

    println("Left half (1-50): ${leftSum}")
    println("Right half (51-100): ${rightSum}")
    println("Total: ${total}")
}