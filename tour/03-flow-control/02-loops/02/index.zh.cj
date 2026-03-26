main() {
    // 遍历数组
    let fruits = ["苹果", "香蕉", "橘子", "葡萄"]
    for (fruit in fruits) {
        println("水果: ${fruit}")
    }
    
    // 遍历区间并求和
    var sum = 0
    for (i in 1..=5) {
        sum += i
    }
    println("1 到 5 的和: ${sum}")
    
    // 使用 where 过滤偶数
    print("0 到 10 中的奇数: ")
    for (i in 0..10 where i % 2 == 1) {
        print("${i} ")
    }
    println("")
    
    // 使用通配符 _ 忽略迭代变量
    var count = 0
    for (_ in 0..5) {
        count++
    }
    println("循环执行了 ${count} 次")
    
    // 遍历元组数组并解构
    let points = [(0, 0), (3, 4), (6, 8)]
    println("坐标点:")
    for ((x, y) in points) {
        println("  (${x}, ${y})")
    }
}