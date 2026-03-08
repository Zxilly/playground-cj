main() {
    // Iterate over an array
    let fruits = ["苹果", "香蕉", "橘子"]
    for (fruit in fruits) {
        println("水果: ${fruit}")
    }

    // Iterate over a range
    print("数字: ")
    for (i in 0..5) {
        print("${i} ")
    }
    println("")

    // Filter with where
    print("偶数: ")
    for (i in 0..10 where i % 2 == 0) {
        print("${i} ")
    }
    println("")

    // Wildcard pattern
    var count = 0
    for (_ in 0..5) {
        count++
    }
    println("循环了 ${count} 次")
}
