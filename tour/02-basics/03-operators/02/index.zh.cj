main() {
    // 比较运算符
    let x = 10
    let y = 20
    
    println("比较运算符:")
    println("${x} == ${y}: ${x == y}")
    println("${x} != ${y}: ${x != y}")
    println("${x} < ${y}: ${x < y}")
    println("${x} <= ${y}: ${x <= y}")
    println("${x} > ${y}: ${x > y}")
    println("${x} >= ${y}: ${x >= y}")
    
    // 逻辑运算符
    println("\n逻辑运算符:")
    let a = true
    let b = false
    println("true && false = ${a && b}")
    println("true || false = ${a || b}")
    println("!true = ${!a}")
    
    // 短路求值示例
    println("\n短路求值:")
    var count = 0
    func increment(): Bool {
        count += 1
        println("  increment() 被调用")
        return true
    }
    
    println("false && increment():")
    let r1 = false && increment()
    println("  结果: ${r1}, count: ${count}")
    
    println("true || increment():")
    let r2 = true || increment()
    println("  结果: ${r2}, count: ${count}")
    
    // 组合使用
    println("\n组合条件:")
    let age = 25
    let hasLicense = true
    let canDrive = age >= 18 && hasLicense
    println("年龄: ${age}, 有驾照: ${hasLicense}")
    println("可以开车: ${canDrive}")
    
    let score = 85
    let isExcellent = score >= 90
    let isGood = score >= 70 && score < 90
    println("分数: ${score}")
    println("优秀: ${isExcellent}, 良好: ${isGood}")
}