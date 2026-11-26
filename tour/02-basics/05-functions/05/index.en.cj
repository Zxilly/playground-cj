// Define named parameters with default values
func greet(name!: String, greeting!: String = "Hello") {
    println("${greeting}, ${name}!")
}

// Multiple parameters with default values
func connect(host!: String, port!: Int64 = 8080, secure!: Bool = false) {
    let protocol = if (secure) { "https" } else { "http" }
    println("Connecting to ${protocol}://${host}:${port}")
}

// Default values can be computed expressions
func repeat(str!: String, times!: Int64 = 3) {
    var result = ""
    for (i in 0..times) {
        result = result + str
    }
    println(result)
}

main() {
    // Use all default values
    greet(name: "Cangjie")
    
    // Override some default values
    greet(name: "World", greeting: "Welcome")
    println("---")
    
    // Different combinations using default values
    connect(host: "example.com")
    connect(host: "example.com", port: 443)
    connect(host: "example.com", port: 443, secure: true)
    connect(host: "localhost", secure: true)
    println("---")
    
    // Use default times parameter
    repeat(str: "Ha")
    
    // Override default times parameter
    repeat(str: "* ", times: 5)
    
    // All parameters passed explicitly
    repeat(str: "OK ", times: 2)
}