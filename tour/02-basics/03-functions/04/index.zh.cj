func createUser(name!: String, age!: Int64, email!: String): Unit {
    println("Name: ${name}")
    println("Age: ${age}")
    println("Email: ${email}")
}

func greet(who!: String, greeting!: String) {
    println("${greeting}, ${who}!")
}

main() {
    createUser(name: "Alice", age: 30, email: "alice@example.com")
    println("---")

    // Named parameters can be in any order
    createUser(email: "bob@example.com", name: "Bob", age: 25)
    println("---")

    greet(greeting: "Hi", who: "Cangjie")
}