import std.collection.HashMap

// Find email by username
func findEmail(name: String): ?String {
    let users = HashMap<String, String>([
        ("alice", "alice@example.com"),
        ("bob", "bob@example.com")
    ])
    
    if (users.contains(name)) {
        return users[name]  // Automatically wrapped as Some
    }
    None
}

main() {
    // Use ?? to provide default value
    let present: ?Int64 = Some(42)
    let missing: ?Int64 = None

    println("Existing value ?? 0 = ${present ?? 0}")
    println("Null value ?? 0 = ${missing ?? 0}")

    // Use ?? in a real scenario
    let alice = findEmail("alice")
    let carol = findEmail("carol")

    println("alice => ${alice ?? "not found"}")
    println("carol => ${carol ?? "not found"}")

    // Use getOrThrow() to unwrap
    try {
        let email = alice.getOrThrow()
        println("alice's email: ${email}")
    } catch (e: NoneValueException) {
        println("Unable to get email")
    }

    // Using getOrThrow() on None will throw an exception
    try {
        let email = carol.getOrThrow()
        println("carol's email: ${email}")
    } catch (e: NoneValueException) {
        println("carol has no email record")
    }
}