// Lambda 表达式：匿名函数的简洁写法

func apply(f: (Int64) -> Int64, value: Int64): Int64 {
    f(value)
}

main() {
    // Lambda 赋值给变量（参数类型可省略）
    let double = { x: Int64 => x * 2 }
    println("double(5) = ${double(5)}")
    
    // 多行 Lambda：if 表达式也是表达式
    let abs = { x: Int64 =>
        if (x < 0) { -x } else { x }
    }
    println("abs(-3) = ${abs(-3)}")
    println("abs(7) = ${abs(7)}")
    
    // Lambda 作为函数参数直接传入
    let result = apply({ x: Int64 => x * 3 }, 4)
    println("apply(三倍函数, 4) = ${result}")
    
    // 无参数 Lambda
    let greet = { => "Hello, Lambda!" }
    println(greet())
    
    // Lambda 立即调用
    let sum = { a: Int64, b: Int64 => a + b }(10, 20)
    println("立即调用结果: ${sum}")
}