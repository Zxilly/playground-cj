class ValidationError <: Exception {
    let field: String

    init(field: String, message: String) {
        super(message)
        this.field = field
    }
}

class NetworkError <: Exception {
    let statusCode: Int64

    init(statusCode: Int64, message: String) {
        super(message)
        this.statusCode = statusCode
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
    return "data from ${url}"
}

main() {
    // Handle validation errors
    try {
        validateEmail("alice_at_example.com")
    } catch (e: ValidationError) {
        println("Validation failed on '${e.field}': ${e.message}")
    }

    try {
        validateEmail("bob@example.com")
        println("Email is valid")
    } catch (e: ValidationError) {
        println("Validation failed: ${e.message}")
    }

    // Handle network errors
    try {
        fetchData("")
    } catch (e: NetworkError) {
        println("Network error (${e.statusCode}): ${e.message}")
    }

    try {
        let data = fetchData("https://api.example.com")
        println("Got: ${data}")
    } catch (e: NetworkError) {
        println("Network error: ${e.message}")
    }
}
