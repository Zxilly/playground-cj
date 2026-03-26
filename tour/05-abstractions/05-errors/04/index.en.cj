// Validation exception: carries field name
open class ValidationError <: Exception {
    public let field: String

    public init(field: String, message: String) {
        this.field = field
        super(message)
    }

    public open override func getClassName(): String {
        "ValidationError"
    }
}

// Network exception: carries status code
open class NetworkError <: Exception {
    public let statusCode: Int64

    public init(statusCode: Int64, message: String) {
        this.statusCode = statusCode
        super(message)
    }

    public open override func getClassName(): String {
        "NetworkError"
    }
}

func validateEmail(email: String): Unit {
    if (!email.contains("@")) {
        throw ValidationError("email", "Invalid email format: ${email}")
    }
}

func fetchData(url: String): String {
    if (url.isEmpty()) {
        throw NetworkError(400, "URL cannot be empty")
    }
    "Data from ${url}"
}

main() {
    // Catch validation exception
    try {
        validateEmail("alice_at_example.com")
        println("Validation passed")
    } catch (e: ValidationError) {
        println("Field '${e.field}' validation failed: ${e.message}")
    }

    // Normal case
    try {
        validateEmail("bob@example.com")
        println("Email validation passed")
    } catch (e: ValidationError) {
        println("Validation failed: ${e.message}")
    }

    // Catch network exception
    try {
        let data = fetchData("")
        println("Retrieved data: ${data}")
    } catch (e: NetworkError) {
        println("Network error (${e.statusCode}): ${e.message}")
    }

    // Can catch both types of exceptions
    try {
        let data = fetchData("https://api.example.com")
        println("Success: ${data}")
    } catch (e: ValidationError) {
        println("Validation error: ${e.message}")
    } catch (e: NetworkError) {
        println("Network error: ${e.message}")
    }
}