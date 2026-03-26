// Files in src/ root directory can omit package declaration
// The compiler automatically assigns package name "default"

// Define a simple greeting function
func greet(name: String): String {
    return "Hello, ${name}!"
}

// Define a calculation function
func add(a: Int64, b: Int64): Int64 {
    return a + b
}

main(): Unit {
    // Call local functions
    println(greet("Cangjie"))
    
    // Demonstrate numeric calculation
    let result = add(10, 20)
    println("Result: ${result}")
    
    // Output current context information
    println("This is code in the default package")
}