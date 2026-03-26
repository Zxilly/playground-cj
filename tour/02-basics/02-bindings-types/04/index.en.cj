main() {
    let x = 42           // Inferred as Int64
    let y = 3.14         // Inferred as Float64
    let s = "hello"      // Inferred as String
    let b = true         // Inferred as Bool

    println("x = ${x}")
    println("y = ${y}")
    println("s = ${s}")
    println("b = ${b}")

    // Subsequent operations based on inferred type
    let sum = x + 10        // sum is also Int64
    let product = y * 2.0   // product is also Float64
    let message = s + "!"   // message is also String
    
    println("sum = ${sum}, product = ${product}")
    println("message = ${message}")
}