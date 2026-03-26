main() {
    // Comparison operators
    let x = 10
    let y = 20
    
    println("=== Comparison Operators ===")
    println("${x} == ${y}: ${x == y}")
    println("${x} != ${y}: ${x != y}")
    println("${x} < ${y}: ${x < y}")
    println("${x} <= ${y}: ${x <= y}")
    println("${x} > ${y}: ${x > y}")
    println("${x} >= ${y}: ${x >= y}")
    
    // Logical operators
    println("\n=== Logical Operators ===")
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
    
    // Practical application: voting eligibility
    let age = 18
    let isCitizen = true
    let canVote = age >= 18 && isCitizen
    println("\nCan vote: ${canVote}")
    
    // Operator precedence
    let result1 = true || false && false  // Equivalent to true || (false && false)
    let result2 = (true || false) && false // Use parentheses to change precedence
    println("\ntrue || false && false = ${result1}")
    println("(true || false) && false = ${result2}")
    
    // Short-circuit evaluation example
    println("\n=== Short-circuit Evaluation ===")
    let num = 15
    if (num > 0 && num % 3 == 0) {
        println("${num} is positive and a multiple of 3")
    }
}