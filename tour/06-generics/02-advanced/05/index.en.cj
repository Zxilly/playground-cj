import std.collection.*

// Define identifiable interface
interface Identifiable {
    func getId(): String
}

// Generic registry class, requires elements to implement Identifiable interface
class Registry<T> where T <: Identifiable {
    let items = HashMap<String, T>()

    // Register new element
    public func register(item: T): Unit {
        items.add(item.getId(), item)
        println("Registered: ID = ${item.getId()}")
    }

    // Find element by ID
    public func find(id: String): Option<T> {
        if (items.contains(id)) {
            Some(items[id])
        } else {
            None
        }
    }

    // Remove element
    public func remove(id: String): Bool {
        if (items.contains(id)) {
            items.remove(id)
            println("Removed: ID = ${id}")
            true
        } else {
            println("Not found: ID = ${id}")
            false
        }
    }

    // Get total count
    public func count(): Int64 {
        items.size
    }

    // List all IDs
    public func listAll(): Unit {
        println("Currently registered ${count()} items:")
        for ((id, _) in items) {
            println("  - ${id}")
        }
    }
}

// User class implements Identifiable
class User <: Identifiable {
    let id: String
    let name: String
    let age: Int64

    init(id: String, name: String, age: Int64) {
        this.id = id
        this.name = name
        this.age = age
    }

    public func getId(): String {
        id
    }

    public func info(): String {
        "${name}, ${age} years old"
    }
}

main() {
    // Create user registry
    let users = Registry<User>()
    println("=== User Registration System ===\n")

    // Register users
    users.register(User("u001", "Zhang San", 25))
    users.register(User("u002", "Li Si", 30))
    users.register(User("u003", "Wang Wu", 28))

    // List all users
    println("")
    users.listAll()

    // Find users
    println("\n=== Find Users ===")
    match (users.find("u002")) {
        case Some(user) => println("Found: ${user.info()}")
        case None => println("User does not exist")
    }

    match (users.find("u999")) {
        case Some(user) => println("Found: ${user.info()}")
        case None => println("User u999 does not exist")
    }

    // Remove users
    println("\n=== Remove Users ===")
    users.remove("u001")
    users.listAll()
}