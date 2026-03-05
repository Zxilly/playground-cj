import std.collection.*

func findUser(name: String): Option<String> {
    let users = HashMap<String, String>()
    users.put("alice", "alice@example.com")
    users.put("bob", "bob@example.com")

    if (users.contains(name)) {
        return Some(users[name])
    }
    return None
}

func parseInt(s: String): Option<Int64> {
    try {
        return Some(Int64.parse(s))
    } catch (_: Exception) {
        return None
    }
}

main() {
    // Creating Option values
    let some: Option<Int64> = Some(42)
    let none: Option<Int64> = None
    println("some = ${some}")
    println("none = ${none}")

    // Using Option as return type
    let email1 = findUser("alice")
    println("alice's email: ${email1}")

    let email2 = findUser("charlie")
    println("charlie's email: ${email2}")

    // Unwrapping with getOrThrow
    let value = some.getOrThrow()
    println("Unwrapped value: ${value}")

    // Parsing with Option
    let n1 = parseInt("123")
    let n2 = parseInt("abc")
    println("parse '123': ${n1}")
    println("parse 'abc': ${n2}")
}