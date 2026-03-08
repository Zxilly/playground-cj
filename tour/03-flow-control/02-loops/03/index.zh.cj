main() {
    // 左闭右开区间: 0, 1, 2, 3, 4
    print("0..5: ")
    for (i in 0..5) {
        print("${i} ")
    }
    println("")

    // 左闭右闭区间: 0, 1, 2, 3, 4, 5
    print("0..=5: ")
    for (i in 0..=5) {
        print("${i} ")
    }
    println("")

    // 指定步长
    print("0..10 : 2 => ")
    for (i in 0..10 : 2) {
        print("${i} ")
    }
    println("")

    // 递减区间
    print("10..=0 : -3 => ")
    for (i in 10..=0 : -3) {
        print("${i} ")
    }
    println("")

    // 用于求和
    var sum = 0
    for (i in 1..=100) {
        sum += i
    }
    println("1 到 100 的和: ${sum}")
}
