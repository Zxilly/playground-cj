// 定义一个接受两个参数并返回它们之和的函数
func add(a: Int64, b: Int64): Int64 {
    return a + b
}

// 定义一个没有返回值的函数（返回类型为 Unit）
func greet(name: String) {
    println("你好，${name}！")
}

// 定义一个计算平方的函数
func square(n: Int64): Int64 {
    return n * n
}

main() {
    let sum = add(10, 20)
    println("10 + 20 = ${sum}")
    
    greet("仓颉")
    
    let result = square(7)
    println("7 的平方是 ${result}")
}