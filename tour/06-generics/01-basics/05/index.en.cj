// Generic enum: represents a result that may succeed or fail
enum Result<T, E> {
    | Ok(T)        // Success, carries a value of type T
    | Err(E)       // Failure, carries an error of type E
}

// Use generic enum to handle division
func safeDivide(a: Int64, b: Int64): Result<Int64, String> {
    if (b == 0) {
        return Err("Divisor cannot be zero")
    }
    return Ok(a / b)
}

// Function to process Result
func processResult(result: Result<Int64, String>) {
    match (result) {
        case Ok(value) =>
            println("Success: result is ${value}")
        case Err(message) =>
            println("Error: ${message}")
    }
}

// Use generic enum to represent a value that may or may not exist
func findValue(key: String, data: Map<String, Int64>): Result<Int64, String> {
    if (data.contains(key)) {
        return Ok(data[key])
    }
    return Err("Key not found: ${key}")
}

main() {
    // Test safe division
    let r1 = safeDivide(10, 3)
    processResult(r1)

    let r2 = safeDivide(10, 0)
    processResult(r2)

    println("---")

    // Test finding value
    let scores = Map<String, Int64>([
        ("Alice", 85),
        ("Bob", 92),
        ("Charlie", 78)
    ])

    let r3 = findValue("Alice", scores)
    processResult(r3)

    let r4 = findValue("David", scores)
    processResult(r4)
}