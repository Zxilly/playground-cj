func requireAdult(age: Int64): Int64 {
    if (age < 18) {
        throw Exception("Age must be at least 18")
    }
    age
}

func divide(a: Int64, b: Int64): Int64 {
    if (b == 0) {
        throw ArithmeticException("Divisor cannot be zero")
    }
    a / b
}

main() {
    // Handle validation exception
    try {
        let age = requireAdult(16)
        println("Adult age: ${age}")
    } catch (e: Exception) {
        println("Validation failed: ${e.message}")
    }

    // Handle arithmetic exception
    try {
        println("20 / 4 = ${divide(20, 4)}")
        println("20 / 0 = ${divide(20, 0)}")
    } catch (e: ArithmeticException) {
        println("Calculation error: ${e.message}")
    }

    // After the first exception is caught, the program continues
    try {
        let age = requireAdult(25)
        println("Validation passed, age: ${age}")
    } catch (e: Exception) {
        println("Validation failed: ${e.message}")
    }

    println("Program ended normally")
}