main() {
    // break: 找到第一个能被 7 整除的数
    for (i in 1..100) {
        if (i % 7 == 0) {
            println("第一个能被 7 整除的数: ${i}")
            break
        }
    }

    // continue: 跳过偶数，只打印奇数
    print("奇数: ")
    for (i in 0..10) {
        if (i % 2 == 0) {
            continue
        }
        print("${i} ")
    }
    println("")

    // 结合使用: 打印前 5 个不能被 3 整除的数
    var count = 0
    print("前5个不能被3整除的正整数: ")
    var n = 1
    while (true) {
        if (n % 3 == 0) {
            n++
            continue
        }
        print("${n} ")
        count++
        n++
        if (count >= 5) {
            break
        }
    }
    println("")
}
