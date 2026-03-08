main() {
    // Basic while loop
    var i = 1
    var sum = 0
    while (i <= 10) {
        sum += i
        i++
    }
    println("1 到 10 的和: ${sum}")

    // do-while loop
    var n = 1
    do {
        print("${n} ")
        n *= 2
    } while (n <= 100)
    println("")
    println("最终 n = ${n}")
}
