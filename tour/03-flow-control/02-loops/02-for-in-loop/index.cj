main() {
    // 遍历数组
    let fruits = ["苹果", "香蕉", "橘子"]
    for (fruit in fruits) {
        println("水果: ${fruit}")
    }

    // 遍历区间
    print("数字: ")
    for (i in 0..5) {
        print("${i} ")
    }
    println("")

    // 使用 where 过滤
    print("偶数: ")
    for (i in 0..10 where i % 2 == 0) {
        print("${i} ")
    }
    println("")

    // 使用通配符
    var count = 0
    for (_ in 0..5) {
        count++
    }
    println("循环了 ${count} 次")
}
