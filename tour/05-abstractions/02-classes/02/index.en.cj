class Person {
    let name: String
    var age: Int64
    var email: String

    // Primary constructor
    init(name: String, age: Int64, email: String) {
        this.name = name
        this.age = age
        this.email = email
    }

    // Constructor with default email
    init(name: String, age: Int64) {
        this.name = name
        this.age = age
        this.email = "unknown"
    }

    func describe(): String {
        "${name} (age: ${age}, email: ${email})"
    }
}

main() {
    let p1 = Person("Alice", 30, "alice@example.com")
    println(p1.describe())

    let p2 = Person("Bob", 25)
    println(p2.describe())
}
