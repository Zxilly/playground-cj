// Define a function using named parameters
// Note: Named parameters use the form name!: Type
func createUser(name!: String, age!: Int64, email!: String) {
    println("Creating user:")
    println("  Name: ${name}")
    println("  Age: ${age}")
    println("  Email: ${email}")
}

// Mix regular parameters and named parameters
// Named parameters must come after regular parameters
func sendEmail(to: String, subject!: String, body!: String) {
    println("Sending email to ${to}:")
    println("  Subject: ${subject}")
    println("  Body: ${body}")
}

main() {
    // Must write named parameter names when calling
    createUser(name: "Li Hua", age: 28, email: "lihua@example.com")
    println("---")
    
    // Named parameters can be passed in any order
    createUser(email: "wang@demo.com", name: "Wang Fang", age: 35)
    println("---")
    
    // Regular parameters passed by position, named parameters by name
    sendEmail(
        "admin@example.com",
        subject: "System Notification",
        body: "Your account has been activated"
    )
    println("---")
    
    // Named parameter order can be adjusted for better readability
    sendEmail(
        "user@test.com",
        body: "This is a test email",
        subject: "Test"
    )
}