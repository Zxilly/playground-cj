main() {
    // break 示例：找到第一个能被 7 整除的数
    print("查找第一个能被 7 整除的数: ")
    for (i in 1..100) {
        if (i % 7 == 0) {
            println("${i}")
            break  // 找到后立即退出循环
        }
    }
    
    // continue 示例：打印奇数
    print("0 到 10 中的奇数: ")
    for (i in 0..10) {
        if (i % 2 == 0) {
            continue  // 跳过偶数
        }
        print("${i} ")
    }
    println("")
    
    // 综合示例：找到前 5 个不能被 3 整除的正整数
    var count = 0
    print("前 5 个不能被 3 整除的正整数: ")
    var n = 1
    while (true) {
        if (n % 3 == 0) {
            n++
            continue  // 跳过能被 3 整除的数
        }
        print("${n} ")
        count++
        n++
        if (count >= 5) {
            break  // 找够 5 个后退出
        }
    }
    println("")
    
    // 嵌套循环中的 break 和 continue
    println("嵌套循环示例（只打印内层循环的前 2 次）:")
    for (i in 1..=3) {
        print("外层 ${i}: ")
        var innerCount = 0
        for (j in 1..=5) {
            print("${j} ")
            innerCount++
            if (innerCount >= 2) {
                break  // 只影响内层循环
            }
        }
        println("")
    }
}