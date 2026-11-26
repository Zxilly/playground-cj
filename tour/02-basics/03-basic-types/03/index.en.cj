main() {
    // Boolean literals
    let isActive = true
    let isAdmin = false
    println("Active user: ${isActive}")
    println("Admin: ${isAdmin}")

    // Logical NOT operation
    println("NOT true = ${!isActive}")
    println("NOT false = ${!isAdmin}")

    // Logical AND and OR
    println("true && false = ${isActive && isAdmin}")
    println("true || false = ${isActive || isAdmin}")

    // Short-circuit evaluation demonstration
    func getValue(): Bool {
        println("  getValue() was called")
        true
    }
    
    println("Short-circuit evaluation example:")
    let r1 = false && getValue()  // getValue will not be called
    println("After false && getValue(), getValue was not called")
    
    let r2 = true || getValue()   // getValue will not be called
    println("After true || getValue(), getValue was not called")

    // Comparison operators produce boolean values
    let x = 10
    let y = 20
    println("${x} > ${y}: ${x > y}")
    println("${x} < ${y}: ${x < y}")
    println("${x} == ${y}: ${x == y}")
    println("${x} != ${y}: ${x != y}")
}