func parseAge(input: String): Int64 {
    let age = Int64.parse(input)
    if (age < 0 || age > 150) {
        throw Exception("Invalid age: ${age}")
    }
    return age
}

func greetUser(name: String, ageStr: String): Unit {
    try {
        let age = parseAge(ageStr)
        println("Hello, ${name}! You are ${age} years old.")
    } catch (e: Exception) {
        println("Error for ${name}: ${e.message}")
    }
}

func divide(a: Int64, b: Int64): Int64 {
    if (b == 0) {
        throw ArithmeticException("Division by zero")
    }
    return a / b
}

main() {
    greetUser("Alice", "25")
    greetUser("Bob", "-5")
    greetUser("Carol", "abc")

    // Multiple catch blocks
    try {
        let result = divide(10, 0)
        println("Result: ${result}")
    } catch (e: ArithmeticException) {
        println("Math error: ${e.message}")
    } catch (e: Exception) {
        println("General error: ${e.message}")
    }

    println("Program continues normally")
}