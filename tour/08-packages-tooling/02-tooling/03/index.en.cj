// cjpm build  - Compile project (incremental compilation)
// cjpm run    - Compile and run
// cjpm test   - Run unit tests
// cjpm clean  - Clean build artifacts

// Utility function: addition
func add(a: Int64, b: Int64): Int64 {
    a + b
}

// Utility function: multiplication
func multiply(a: Int64, b: Int64): Int64 {
    a * b
}

// Utility function: square
func square(x: Int64): Int64 {
    x * x
}

main(): Unit {
    let x = 5
    let y = 3
    
    println("Utility Function Examples")
    println("=============")
    println("${x} + ${y} = ${add(x, y)}")
    println("${x} * ${y} = ${multiply(x, y)}")
    println("${x} squared = ${square(x)}")
    
    // Try: change the add function to subtraction and see the result
}