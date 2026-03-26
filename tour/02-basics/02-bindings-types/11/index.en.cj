main() {
    // Basic arithmetic operations
    let a = 17
    let b = 5
    
    println("=== Basic Arithmetic Operations ===")
    println("${a} + ${b} = ${a + b}")
    println("${a} - ${b} = ${a - b}")
    println("${a} * ${b} = ${a * b}")
    println("${a} / ${b} = ${a / b}")
    println("${a} % ${b} = ${a % b}")
    
    // Division and modulo with negative numbers
    println("\n=== Division and Modulo with Negatives ===")
    println("7 / 3 = ${7 / 3}")
    println("-7 / 3 = ${-7 / 3}")
    println("7 / -3 = ${7 / -3}")
    println("-7 / -3 = ${-7 / -3}")
    println("-7 % 3 = ${-7 % 3}")
    println("7 % -3 = ${7 % -3}")
    
    // Exponentiation
    println("\n=== Exponentiation ===")
    let base: Int64 = 2
    let exp: UInt64 = 10
    println("${base} ** ${exp} = ${base ** exp}")
    
    // Floating-point exponentiation
    let floatBase: Float64 = 2.0
    println("${floatBase} ** 3 = ${floatBase ** 3}")
    println("${floatBase} ** 3.0 = ${floatBase ** 3.0}")
    
    // String concatenation
    println("\n=== String Concatenation ===")
    let s1 = "Hello"
    let s2 = "Cangjie"
    println(s1 + " " + s2 + "!")
}