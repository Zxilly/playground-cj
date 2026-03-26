main() {
    // Type inference: compiler automatically infers types from initial values
    let x = 42          // Inferred as Int64
    let y = 3.14        // Inferred as Float64
    let s = "hello"     // Inferred as String
    let b = true        // Inferred as Bool
    
    // Expression result types are also inferred
    let sum = x + 8     // Inferred as Int64 (Int64 + Int64)
    let pi = y * 2.0    // Inferred as Float64 (Float64 * Float64)
    
    println("Integer: ${x}")
    println("Float: ${y}")
    println("String: ${s}")
    println("Boolean: ${b}")
    println("Sum: ${sum}")
    println("Double pi: ${pi}")
    
    // Type mismatch causes compilation error:
    // x = "string"  // Error! Cannot assign String to Int64
    // y = 100      // Error! Cannot assign Int64 to Float64
}