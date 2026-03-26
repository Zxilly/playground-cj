main() {
    // 比较运算符
    let x = 10
    let y = 20
    
    println("=== 比较运算符 ===")
    println("${x} == ${y}: ${x == y}")
    println("${x} != ${y}: ${x != y}")
    println("${x} < ${y}: ${x < y}")
    println("${x} <= ${y}: ${x <= y}")
    println("${x} > ${y}: ${x > y}")
    println("${x} >= ${y}: ${x >= y}")
    
    // 逻辑运算符
    println("\n=== 逻辑运算符 ===")
    let a = true
    let b = false
    println("!true = ${!a}")
    println("!false = ${!b}")
    println("true && true = ${a && a}")
    println("true && false = ${a && b}")
    println("false && true = ${b && a}")
    println("false && false = ${b && b}")
    println("true || true = ${a || a}")
    println("true || false = ${a || b}")
    println("false || true = ${b || a}")
    println("false || false = ${b || b}")
    
    // 实际应用：判断能否投票
    let age = 18
    let isCitizen = true
    let canVote = age >= 18 && isCitizen
    println("\n可以投票: ${canVote}")
    
    // 运算符优先级
    let result1 = true || false && false  // 等价于 true || (false && false)
    let result2 = (true || false) && false // 使用括号改变优先级
    println("\ntrue || false && false = ${result1}")
    println("(true || false) && false = ${result2}")
    
    // 短路求值示例
    println("\n=== 短路求值 ===")
    let num = 15
    if (num > 0 && num % 3 == 0) {
        println("${num} 是正数且是 3 的倍数")
    }
}