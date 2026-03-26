// 位于 src/ 根目录的文件可以省略包声明
// 编译器会自动指定包名为 "default"

// 定义一个简单的问候函数
func greet(name: String): String {
    return "你好, ${name}!"
}

// 定义一个计算函数
func add(a: Int64, b: Int64): Int64 {
    return a + b
}

main(): Unit {
    // 调用本地函数
    println(greet("仓颉"))
    
    // 演示数值计算
    let result = add(10, 20)
    println("计算结果: ${result}")
    
    // 输出当前上下文信息
    println("这是默认包中的代码")
}