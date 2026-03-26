main() {
    let isActive = true
    let isAdmin = false

    println("isActive: ${isActive}")
    println("isAdmin: ${isAdmin}")

    // Logical NOT
    let notActive = !isActive
    println("NOT isActive: ${notActive}")

    // Logical AND (true only when both are true)
    let canEdit = isActive && isAdmin
    println("AND isActive && isAdmin: ${canEdit}")

    // Logical OR (true when at least one is true)
    let canView = isActive || isAdmin
    println("OR isActive || isAdmin: ${canView}")

    // Comparison operators produce boolean values
    let x = 10
    let y = 20
    println("${x} > ${y}: ${x > y}")
    println("${x} < ${y}: ${x < y}")
    println("${x} == ${y}: ${x == y}")
    println("${x} != ${y}: ${x != y}")
    println("${x} >= ${y}: ${x >= y}")
    println("${x} <= ${y}: ${x <= y}")

    // Combined logical expressions
    let hasPermission = isActive && (isAdmin || x > 5)
    println("Complex condition: ${hasPermission}")

    // Short-circuit evaluation example
    let a = false
    let result = a && (10 / 0 == 1)  // No division by zero, since a is already false
    println("Short-circuit result: ${result}")
}