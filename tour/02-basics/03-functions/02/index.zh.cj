// 隐式返回：最后一个表达式就是返回值
func multiply(a: Int64, b: Int64): Int64 {
    a * b  // 不需要 return 关键字
}

// 隐式返回布尔值
func isPositive(n: Int64): Bool {
    n > 0  // 这个比较表达式的结果就是返回值
}

// 隐式返回字符串
func describe(name: String, age: Int64): String {
    "${name} 今年 ${age} 岁"  // 字符串插值表达式作为返回值
}

// 混合使用：可以在中间用 return，最后一个表达式隐式返回
func abs(n: Int64): Int64 {
    if (n < 0) {
        return -n  // 提前返回
    }
    n  // 正数的返回值
}

main() {
    println("6 × 7 = ${multiply(6, 7)}")
    
    println("-5 是正数吗？ ${isPositive(-5)}")
    println("10 是正数吗？ ${isPositive(10)}")
    
    println(describe("小明", 25))
    
    println("|-8| = ${abs(-8)}")
    println("|15| = ${abs(15)}")
}