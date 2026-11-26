// Implicit return: the last expression is the return value
func multiply(a: Int64, b: Int64): Int64 {
    a * b  // No return keyword needed
}

// Implicit return of a boolean value
func isPositive(n: Int64): Bool {
    n > 0  // The result of this comparison expression is the return value
}

// Implicit return of a string
func describe(name: String, age: Int64): String {
    "${name} is ${age} years old"  // String interpolation expression as return value
}

// Mixed usage: can use return in the middle, with implicit return at the end
func abs(n: Int64): Int64 {
    if (n < 0) {
        return -n  // Early return
    }
    n  // Return value for positive numbers
}

main() {
    println("6 × 7 = ${multiply(6, 7)}")
    
    println("Is -5 positive? ${isPositive(-5)}")
    println("Is 10 positive? ${isPositive(10)}")
    
    println(describe("Xiaoming", 25))
    
    println("|-8| = ${abs(-8)}")
    println("|15| = ${abs(15)}")
}