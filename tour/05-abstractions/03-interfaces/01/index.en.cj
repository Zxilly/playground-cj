// Define two interfaces
interface Printable {
    func display(): String
}

interface Named {
    func name(): String {
        "anonymous"  // Default implementation
    }
}

// User class implements both interfaces
class User <: Printable & Named {
    let username: String

    init(username: String) {
        this.username = username
    }

    public func display(): String {
        "User: ${username}"
    }

    public func name(): String {
        username  // Override default implementation
    }
}

// Student class uses Named's default implementation
class Student <: Printable & Named {
    let id: String

    init(id: String) {
        this.id = id
    }

    public func display(): String {
        "Student: ${id}"
    }
    // name() not provided, uses default value "anonymous"
}

main() {
    let user = User("Zhang San")
    let student = Student("S001")

    println("=== User ===")
    println(user.display())
    println("name = ${user.name()}")

    println("\n=== Student ===")
    println(student.display())
    println("name = ${student.name()}")  // Uses default implementation
}