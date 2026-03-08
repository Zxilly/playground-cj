func sumRange(start: Int64, end: Int64): Int64 {
    var total = 0
    var current = start
    while (current <= end) {
        total += current
        current += 1
    }
    return total
}

main() {
    let left = spawn {
        sumRange(1, 50)
    }

    let right = spawn {
        sumRange(51, 100)
    }

    let total = left.get() + right.get()
    println("sum(1..100) = ${total}")
}
