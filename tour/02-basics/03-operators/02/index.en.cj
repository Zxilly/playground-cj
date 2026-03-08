main() {
    let x = 10
    let y = 20

    // Comparison operators
    println("${x} == ${y}: ${x == y}")
    println("${x} != ${y}: ${x != y}")
    println("${x} < ${y}: ${x < y}")
    println("${x} >= ${y}: ${x >= y}")

    // Logical operators
    let a = true
    let b = false
    println("${a} && ${b} = ${a && b}")
    println("${a} || ${b} = ${a || b}")
    println("!${a} = ${!a}")

    // Combined usage
    let age = 25
    let hasLicense = true
    let canDrive = age >= 18 && hasLicense
    println("可以开车: ${canDrive}")
}
