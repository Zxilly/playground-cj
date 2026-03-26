main() {
    // 基本赋值
    var score: Int64 = 10
    println("初始分数: ${score}")
    
    score = 15
    println("重新赋值后: ${score}")
    
    // 复合赋值运算符
    score += 5      // 等价于 score = score + 5
    println("score += 5 => ${score}")
    
    score *= 2      // 等价于 score = score * 2
    println("score *= 2 => ${score}")
    
    score -= 10     // 等价于 score = score - 10
    println("score -= 10 => ${score}")
    
    score /= 2      // 等价于 score = score / 2
    println("score /= 2 => ${score}")
    
    score %= 7      // 等价于 score = score % 7
    println("score %= 7 => ${score}")
    
    // 求幂赋值
    score = 2
    score **= 3     // 等价于 score = score ** UInt64(3)，右操作数需为 UInt64
    println("2 **= 3 => ${score}")
    
    // 赋值表达式的类型是 Unit
    println("\n=== 赋值表达式的值 ===")
    let unitValue = (score = 100)
    println("赋值表达式的值: ${unitValue}")
    println("赋值后 score = ${score}")
    
    // 逻辑复合赋值
    var flag = true
    println("\n=== 逻辑复合赋值 ===")
    println("初始 flag = ${flag}")
    
    flag &&= false  // 等价于 flag = flag && false
    println("flag &&= false => ${flag}")
    
    flag ||= true   // 等价于 flag = flag || true
    println("flag ||= true => ${flag}")
}