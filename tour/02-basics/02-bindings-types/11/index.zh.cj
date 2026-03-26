main() {
    // 基本算术运算
    let a = 17
    let b = 5
    
    println("=== 基本算术运算 ===")
    println("${a} + ${b} = ${a + b}")
    println("${a} - ${b} = ${a - b}")
    println("${a} * ${b} = ${a * b}")
    println("${a} / ${b} = ${a / b}")
    println("${a} % ${b} = ${a % b}")
    
    // 负数的除法和取余
    println("\n=== 负数除法与取余 ===")
    println("7 / 3 = ${7 / 3}")
    println("-7 / 3 = ${-7 / 3}")
    println("7 / -3 = ${7 / -3}")
    println("-7 / -3 = ${-7 / -3}")
    println("-7 % 3 = ${-7 % 3}")
    println("7 % -3 = ${7 % -3}")
    
    // 求幂运算
    println("\n=== 求幂运算 ===")
    let base: Int64 = 2
    let exp: UInt64 = 10
    println("${base} ** ${exp} = ${base ** exp}")
    
    // 浮点数求幂
    let floatBase: Float64 = 2.0
    println("${floatBase} ** 3 = ${floatBase ** 3}")
    println("${floatBase} ** 3.0 = ${floatBase ** 3.0}")
    
    // 字符串拼接
    println("\n=== 字符串拼接 ===")
    let s1 = "Hello"
    let s2 = "Cangjie"
    println(s1 + " " + s2 + "!")
}