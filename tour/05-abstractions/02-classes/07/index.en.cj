// Sealed class: restricts subclasses to same package
sealed abstract class Result {
    public func message(): String
    public func isSuccess(): Bool
}

// Success result
class Success <: Result {
    let value: Int64

    public init(value: Int64) {
        this.value = value
    }

    public func message(): String {
        "Success: value = ${value}"
    }

    public func isSuccess(): Bool {
        true
    }
}

// Failure result
class Failure <: Result {
    let reason: String

    public init(reason: String) {
        this.reason = reason
    }

    public func message(): String {
        "Failure: reason = ${reason}"
    }

    public func isSuccess(): Bool {
        false
    }
}

// General function to handle results
func handleResult(result: Result): Unit {
    println("Handling result: ${result.message()}")

    if (result.isSuccess()) {
        println("  -> Operation succeeded, continue to next step")
    } else {
        println("  -> Operation failed, need to handle error")
    }
}

main() {
    // Create different results
    let results: Array<Result> = [
        Success(42),
        Success(100),
        Failure("Network timeout"),
        Failure("Permission denied")
    ]

    println("Processing all results:")
    for (result in results) {
        handleResult(result)
        println()
    }

    // Business scenario: handle by type
    println("Business processing:")
    let r1 = Success(200)
    let r2 = Failure("Connection failed")

    println(r1.message())
    println("Status: ${if (r1.isSuccess()) "OK" else "Error"}")

    println()
    println(r2.message())
    println("Status: ${if (r2.isSuccess()) "OK" else "Error"}")

    // Compiler knows there are only two subclasses, enabling optimization
    // If using match expression, can exhaustively check all cases
}