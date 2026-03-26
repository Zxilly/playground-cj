class Person {
    let name: String
    var age: Int64
    var email: String

    // Regular constructor: full parameter list
    public init(name: String, age: Int64, email: String) {
        this.name = name
        this.age = age
        this.email = email
    }

    // Regular constructor: overloaded, omitting email
    public init(name: String, age: Int64) {
        this.name = name
        this.age = age
        this.email = "Not set"
    }

    // Member function
    public func describe(): String {
        "${name} (Age: ${age}, Email: ${email})"
    }

    public func celebrateBirthday() {
        age += 1
        println("${name} had a birthday! Now ${age} years old")
    }
}

main() {
    // Create objects using different constructors
    let p1 = Person("Xiaoming", 25, "xiaoming@example.com")
    println(p1.describe())

    let p2 = Person("Xiaohong", 30)
    println(p2.describe())

    // Call member functions
    p1.celebrateBirthday()
    p2.celebrateBirthday()

    println("Final information:")
    println(p1.describe())
    println(p2.describe())
}