main() {
    // 基本赋值
    var score = 10
    println("初始分数: ${score}")
    
    score = 12
    println("重新赋值后: ${score}")
    
    // 复合赋值运算符
    score += 5
    println("score += 5 => ${score}")
    
    score -= 3
    println("score -= 3 => ${score}")
    
    score *= 2
    println("score *= 2 => ${score}")
    
    score /= 2
    println("score /= 2 => ${score}")
    
    score %= 4
    println("score %= 4 => ${score}")
    
    // 求幂赋值
    var base = 2
    base **= 3
    println("\n2 **= 3 => ${base}")
    
    // 多赋值表达式
    println("\n多赋值表达式:")
    var x = 10
    var y = 20
    println("交换前: x = ${x}, y = ${y}")
    (x, y) = (y, x)
    println("交换后: x = ${x}, y = ${y}")
    
    // 部分忽略赋值
    var a: Int64
    (a, _) = (100, 200)
    println("\n(a, _) = (100, 200) => a = ${a}")
    
    // 赋值表达式返回 Unit
    println("\n赋值表达式演示:")
    score = 50
    println("赋值前 score = ${score}")
    let result = (score = 100)
    println("赋值后 score = ${score}")
    println("赋值表达式的值: ${result}")
}