main() {
    // Half-open range: 0, 1, 2, 3, 4
    print("0..5: ")
    for (i in 0..5) {
        print("${i} ")
    }
    println("")

    // Closed range: 0, 1, 2, 3, 4, 5
    print("0..=5: ")
    for (i in 0..=5) {
        print("${i} ")
    }
    println("")

    // Specifying a step
    print("0..10 : 2 => ")
    for (i in 0..10 : 2) {
        print("${i} ")
    }
    println("")

    // Decreasing range
    print("10..=0 : -3 => ")
    for (i in 10..=0 : -3) {
        print("${i} ")
    }
    println("")

    // Used for summation
    var sum = 0
    for (i in 1..=100) {
        sum += i
    }
    println("1 到 100 的和: ${sum}")
}
