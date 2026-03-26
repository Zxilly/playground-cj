// 函数是一等公民，可以有类型、赋值给变量、作为参数传递

func double(x: Int64): Int64 {
    x * 2
}

func square(x: Int64): Int64 {
    x * x
}

// 函数类型作为参数类型
func apply(f: (Int64) -> Int64, value: Int64): Int64 {
    f(value)
}

main() {
    // 将函数赋值给变量
    let fn: (Int64) -> Int64 = double
    println("fn(5) = ${fn(5)}")
    
    // 函数作为参数传递
    println("apply(double, 4) = ${apply(double, 4)}")
    println("apply(square, 4) = ${apply(square, 4)}")
    
    // 用 var 声明可以重新赋值
    var operation = double
    println("operation(3) = ${operation(3)}")
    operation = square
    println("operation(3) = ${operation(3)}")
}