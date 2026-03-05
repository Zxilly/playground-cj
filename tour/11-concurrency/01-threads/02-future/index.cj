func computeSum(start: Int64, end: Int64): Int64 {
    var sum: Int64 = 0
    var i = start
    while (i <= end) {
        sum += i
        i += 1
    }
    return sum
}

main() {
    // Parallel computation: sum of 1 to 1000
    // Split into 4 parts
    let f1 = spawn { computeSum(1, 250) }
    let f2 = spawn { computeSum(251, 500) }
    let f3 = spawn { computeSum(501, 750) }
    let f4 = spawn { computeSum(751, 1000) }

    // Collect results
    let r1 = f1.get()
    let r2 = f2.get()
    let r3 = f3.get()
    let r4 = f4.get()

    let total = r1 + r2 + r3 + r4

    println("Part 1 (1-250):   ${r1}")
    println("Part 2 (251-500): ${r2}")
    println("Part 3 (501-750): ${r3}")
    println("Part 4 (751-1000): ${r4}")
    println("Total sum: ${total}")
}