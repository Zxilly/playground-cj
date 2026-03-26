main() {
    // Define mutable bindings
    var count = 0
    println("Initial value: ${count}")
    
    // var variables can be modified multiple times
    count = 10
    println("First modification: ${count}")
    
    count = count + 5
    println("Second modification: ${count}")
    
    // Another mutable binding example
    var message = "hello"
    message = "world"  // Can be modified
    println("Message: ${message}")
    
    // Chained assignment is not supported:
    // var a = 0
    // var b = 0
    // a = b = 1  // Syntax error
}