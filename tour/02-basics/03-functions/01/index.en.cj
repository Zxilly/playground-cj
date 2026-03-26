// Define a function that takes two parameters and returns their sum
func add(a: Int64, b: Int64): Int64 {
    return a + b
}

// Define a function with no return value (return type is Unit)
func greet(name: String) {
    println("Hello, ${name}!")
}

// Define a function to calculate the square
func square(n: Int64): Int64 {
    return n * n
}

main() {
    let sum = add(10, 20)
    println("10 + 20 = ${sum}")
    
    greet("Cangjie")
    
    let result = square(7)
    println("The square of 7 is ${result}")
}