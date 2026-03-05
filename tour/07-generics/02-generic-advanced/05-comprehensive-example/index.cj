import std.collection.*

interface Identifiable {
    func getId(): String
}

class Registry<T> where T <: Identifiable {
    let items = HashMap<String, T>()

    public func register(item: T): Unit {
        items.put(item.getId(), item)
    }

    public func find(id: String): Option<T> {
        return if (items.contains(id)) {
            Some(items[id])
        } else {
            None
        }
    }

    public func count(): Int64 {
        return items.size
    }

    public func all(): ArrayList<T> {
        let result = ArrayList<T>()
        for ((_, v) in items) {
            result.append(v)
        }
        return result
    }
}

class User <: Identifiable {
    let id: String
    let name: String
    let email: String

    init(id: String, name: String, email: String) {
        this.id = id
        this.name = name
        this.email = email
    }

    public func getId(): String { return id }
}

class Product <: Identifiable {
    let id: String
    let title: String
    let price: Float64

    init(id: String, title: String, price: Float64) {
        this.id = id
        this.title = title
        this.price = price
    }

    public func getId(): String { return id }
}

main() {
    let users = Registry<User>()
    users.register(User("u1", "Alice", "alice@example.com"))
    users.register(User("u2", "Bob", "bob@example.com"))
    println("Users registered: ${users.count()}")

    match (users.find("u1")) {
        case Some(u) => println("Found: ${u.name} (${u.email})")
        case None => println("Not found")
    }

    let products = Registry<Product>()
    products.register(Product("p1", "Laptop", 999.99))
    products.register(Product("p2", "Mouse", 29.99))
    println("Products registered: ${products.count()}")

    match (products.find("p2")) {
        case Some(p) => println("Found: ${p.title} - $${p.price}")
        case None => println("Not found")
    }
}