main() {
    // 类型推断：编译器根据初始值自动推断类型
    let x = 42          // 推断为 Int64
    let y = 3.14        // 推断为 Float64
    let s = "hello"     // 推断为 String
    let b = true        // 推断为 Bool
    
    // 表达式结果的类型也会被推断
    let sum = x + 8     // 推断为 Int64（Int64 + Int64）
    let pi = y * 2.0    // 推断为 Float64（Float64 * Float64）
    
    println("整数: ${x}")
    println("浮点数: ${y}")
    println("字符串: ${s}")
    println("布尔值: ${b}")
    println("和: ${sum}")
    println("两倍 pi: ${pi}")
    
    // 类型不匹配会导致编译错误：
    // x = "字符串"  // 错误！不能将 String 赋值给 Int64
    // y = 100      // 错误！不能将 Int64 赋值给 Float64
}