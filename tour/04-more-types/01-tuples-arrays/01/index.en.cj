main() {
    // Create a tuple
    let point: (Int64, Int64) = (3, 4)
    println("Point coordinates: (${point[0]}, ${point[1]})")
    
    // Tuples can contain different types
    let person: (String, Int64, Bool) = ("Alice", 25, true)
    println("Name: ${person[0]}, Age: ${person[1]}, Employed: ${person[2]}")
    
    // Tuple destructuring
    let (x, y) = point
    println("After destructuring: x = ${x}, y = ${y}")
    
    // Tuples declared with var can be reassigned as a whole
    var pi = (3.14, "PI")
    println("Original: ${pi[0]}, ${pi[1]}")
    pi = (3.14159, "More precise PI")
    println("Reassigned: ${pi[0]}, ${pi[1]}")
    
    // Tuples can be used as function return values to achieve multiple returns
    let result = divideAndMod(17, 5)
    println("17 ÷ 5 = ${result[0]} remainder ${result[1]}")
}

// Returns a tuple of quotient and remainder
func divideAndMod(a: Int64, b: Int64): (Int64, Int64) {
    (a / b, a % b)
}