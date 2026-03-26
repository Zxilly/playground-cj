// Using exceptions: division by zero is a program error that should be fixed
func divideException(a: Float64, b: Float64): Float64 {
    if (b == 0.0) {
        throw IllegalArgumentException("Divisor cannot be zero")
    }
    a / b
}

// Using Option: division by zero is a normal possibility that needs handling
func divideOption(a: Float64, b: Float64): Option<Float64> {
    if (b == 0.0) {
        None
    } else {
        Some(a / b)
    }
}

// Simulate lookup operation: not existing is a normal result
func findUser(id: Int64): Option<String> {
    if (id == 1) {
        Some("Alice")
    } else if (id == 2) {
        Some("Bob")
    } else {
        None  // User not existing is a normal case
    }
}

main() {
    // Exception style: expects caller to pass valid parameters
    try {
        let result = divideException(10.0, 2.0)
        println("10.0 / 2.0 = ${result}")
    } catch (e: IllegalArgumentException) {
        println("Error: ${e.message}")
    }

    // Option style: caller must handle None
    let r1 = divideOption(10.0, 4.0)
    let r2 = divideOption(10.0, 0.0)

    match (r1) {
        case Some(v) => println("10.0 / 4.0 = ${v}")
        case None => println("Division by zero error")
    }

    match (r2) {
        case Some(v) => println("10.0 / 0.0 = ${v}")
        case None => println("Division by zero error")
    }

    // Use ?? to provide default value
    let safe1 = divideOption(10.0, 2.0) ?? 0.0
    let safe2 = divideOption(10.0, 0.0) ?? 0.0
    println("With default value: ${safe1}, ${safe2}")

    // Lookup operation: not existing is normal
    match (findUser(1)) {
        case Some(name) => println("Found user: ${name}")
        case None => println("User not found")
    }

    match (findUser(99)) {
        case Some(name) => println("Found user: ${name}")
        case None => println("User not found")
    }
}