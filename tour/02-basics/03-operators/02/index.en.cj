main() {
    // Comparison operators
    let x = 10
    let y = 20
    
    println("Comparison operators:")
    println("${x} == ${y}: ${x == y}")
    println("${x} != ${y}: ${x != y}")
    println("${x} < ${y}: ${x < y}")
    println("${x} <= ${y}: ${x <= y}")
    println("${x} > ${y}: ${x > y}")
    println("${x} >= ${y}: ${x >= y}")
    
    // Logical operators
    println("\nLogical operators:")
    let a = true
    let b = false
    println("true && false = ${a && b}")
    println("true || false = ${a || b}")
    println("!true = ${!a}")
    
    // Short-circuit evaluation example
    println("\nShort-circuit evaluation:")
    var count = 0
    func increment(): Bool {
        count += 1
        println("  increment() called")
        return true
    }
    
    println("false && increment():")
    let r1 = false && increment()
    println("  result: ${r1}, count: ${count}")
    
    println("true || increment():")
    let r2 = true || increment()
    println("  result: ${r2}, count: ${count}")
    
    // Combined usage
    println("\nCombined conditions:")
    let age = 25
    let hasLicense = true
    let canDrive = age >= 18 && hasLicense
    println("Age: ${age}, Has license: ${hasLicense}")
    println("Can drive: ${canDrive}")
    
    let score = 85
    let isExcellent = score >= 90
    let isGood = score >= 70 && score < 90
    println("Score: ${score}")
    println("Excellent: ${isExcellent}, Good: ${isGood}")
}