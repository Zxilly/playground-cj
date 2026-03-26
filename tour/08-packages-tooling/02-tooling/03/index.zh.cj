// cjpm build  - 编译项目（增量编译）
// cjpm run    - 编译并运行
// cjpm test   - 运行单元测试
// cjpm clean  - 清理编译产物

// 工具函数：加法
func add(a: Int64, b: Int64): Int64 {
    a + b
}

// 工具函数：乘法
func multiply(a: Int64, b: Int64): Int64 {
    a * b
}

// 工具函数：平方
func square(x: Int64): Int64 {
    x * x
}

main(): Unit {
    let x = 5
    let y = 3
    
    println("计算工具函数示例")
    println("=============")
    println("${x} + ${y} = ${add(x, y)}")
    println("${x} * ${y} = ${multiply(x, y)}")
    println("${x} 的平方 = ${square(x)}")
    
    // 试一试：把 add 函数改成减法，看看结果如何
}