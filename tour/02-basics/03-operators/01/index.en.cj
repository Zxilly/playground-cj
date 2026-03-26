main() {
    // Basic arithmetic operations
    let a = 17
    let b = 5
    
    println("Basic operations:")
    println("${a} + ${b} = ${a + b}")
    println("${a} - ${b} = ${a - b}")
    println("${a} * ${b} = ${a * b}")
    println("${a} / ${b} = ${a / b}")
    println("${a} % ${b} = ${a % b}")
    
    // Integer division rounds toward zero
    println("\nInteger division:")
    println("7 / 3 = ${7 / 3}")
    println("-7 / 3 = ${-7 / 3}")
    println("7 / -3 = ${7 / -3}")
    
    // Remainder operation
    println("\nRemainder operation:")
    println("-7 % 3 = ${-7 % 3}")
    println("7 % -3 = ${7 % -3}")
    
    // Exponentiation
    println("\nExponentiation:")
    println("2 ** 3 = ${2 ** 3}")
    println("2.0 ** 3 = ${2.0 ** 3}")
    
    // Using parentheses to change operation order
    println("\nOperator precedence:")
    println("2 + 3 * 4 = ${2 + 3 * 4}")
    println("(2 + 3) * 4 = ${(2 + 3) * 4}")
    
    // Unary minus
    let x = 8
    println("\nUnary minus:")
    println("x = ${x}, -x = ${-x}")
}