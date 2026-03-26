main() {
    // Single-line comment: this line of code will print a message
    println("Comments don't affect program execution")
    
    // Single-line comments can follow code
    let x = 100  // Define variable x
    
    /* 
     * Multi-line comments can span multiple lines
     * Commonly used to describe complex logic
     * Or temporarily disable code blocks
     */
    let y = 200
    println("x = ${x}, y = ${y}")
    
    /* 
     * Calculate sum and product of two numbers
     */
    let sum = x + y
    let product = x * y
    println("${x} + ${y} = ${sum}")
    println("${x} * ${y} = ${product}")
    
    /* Cangjie's multi-line comments support /* nested usage */ */
    println("Nested comments are one of Cangjie's features")
    
    // Temporarily commented out code:
    // let z = 300
    // println("z = ${z}")
    
    // Note: Good comments explain "why", not "what"
    let divisor = 1024  // Use 1024 as KB conversion factor
    let bytes = 2048
    let kb = bytes / divisor
    println("${bytes} bytes = ${kb} KB")
}