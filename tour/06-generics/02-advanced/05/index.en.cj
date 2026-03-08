import std.collection.*

interface Identifiable {
    func getId(): String
}

class Registry<T> where T <: Identifiable {
    let items = HashMap<String, T>()

    public func register(item: T) {
        items.add(item.getId(), item)
    }

    public func find(id: String): Option<T> {
        if (items.contains(id)) {
            Some(items[id])
        } else {
            None
        }
    }

    public func count(): Int64 {
        items.size
    }
}

class User <: Identifiable {
    let id: String
    let name: String

    init(id: String, name: String) {
        this.id = id
        this.name = name
    }

    public func getId(): String {
        id
    }
}

main() {
    let users = Registry<User>()
    users.register(User("u1", "Alice"))
    users.register(User("u2", "Bob"))
    println(users.count())

    match (users.find("u2")) {
        case Some(user) => println(user.name)
        case None => println("not found")
    }
}
