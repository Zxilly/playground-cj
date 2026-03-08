func processNumbers(numbers: Array<Int64>): (Int64, Int64) {
    func sum(arr: Array<Int64>): Int64 {
        var total = 0
        for (n in arr) {
            total += n
        }
        total
    }

    func average(arr: Array<Int64>): Int64 {
        sum(arr) / arr.size
    }

    (sum(numbers), average(numbers))
}

main() {
    let data = [10, 20, 30, 40, 50]
    let (total, avg) = processNumbers(data)
    println("Sum: ${total}")
    println("Average: ${avg}")
}