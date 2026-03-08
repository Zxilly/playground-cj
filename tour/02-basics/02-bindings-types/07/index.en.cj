main() {
    let isActive = true
    let isAdmin = false

    println("isActive: ${isActive}")
    println("isAdmin: ${isAdmin}")

    // Logical operators
    println("AND: ${isActive && isAdmin}")
    println("OR: ${isActive || isAdmin}")
    println("NOT: ${!isActive}")

    // Comparison operators produce booleans
    let x = 10
    let y = 20
    println("${x} > ${y}: ${x > y}")
    println("${x} < ${y}: ${x < y}")
    println("${x} == ${y}: ${x == y}")
}
