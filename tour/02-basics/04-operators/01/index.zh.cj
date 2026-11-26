main() {
    // 基本算术运算
    let a = 17
    let b = 5
    
    println("基本运算:")
    println("${a} + ${b} = ${a + b}")
    println("${a} - ${b} = ${a - b}")
    println("${a} * ${b} = ${a * b}")
    println("${a} / ${b} = ${a / b}")
    println("${a} % ${b} = ${a % b}")
    
    // 整数除法向零舍入
    println("\n整数除法:")
    println("7 / 3 = ${7 / 3}")
    println("-7 / 3 = ${-7 / 3}")
    println("7 / -3 = ${7 / -3}")
    
    // 取余运算
    println("\n取余运算:")
    println("-7 % 3 = ${-7 % 3}")
    println("7 % -3 = ${7 % -3}")
    
    // 求幂运算
    println("\n求幂运算:")
    println("2 ** 3 = ${2 ** 3}")
    println("2.0 ** 3 = ${2.0 ** 3}")
    
    // 使用括号改变运算顺序
    println("\n运算优先级:")
    println("2 + 3 * 4 = ${2 + 3 * 4}")
    println("(2 + 3) * 4 = ${(2 + 3) * 4}")
    
    // 一元负号
    let x = 8
    println("\n一元负号:")
    println("x = ${x}, -x = ${-x}")
}