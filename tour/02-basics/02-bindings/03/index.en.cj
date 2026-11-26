main() {
    // Use type annotations to explicitly specify variable types
    let score: Int64 = 95
    let title: String = "Cangjie Language"
    let ready: Bool = true
    let price: Float64 = 19.99
    
    println("Score: ${score}")
    println("Title: ${title}")
    println("Ready: ${ready}")
    println("Price: ${price}")
    
    // Type annotations help the compiler catch errors:
    // let wrong: Int64 = "string"  // Error! Type mismatch
}