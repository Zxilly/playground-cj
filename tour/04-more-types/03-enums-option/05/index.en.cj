import std.collection.HashMap

func findEmail(name: String): ?String {
    let users = HashMap<String, String>([("alice", "alice@example.com"), ("bob", "bob@example.com")])
    if (users.contains(name)) {
        return Some(users[name])
    }
    return None
}

main(): Int64 {
    let present: ?Int64 = Some(42)
    let missing: ?Int64 = None

    println("present ?? 0 = ${present ?? 0}")
    println("missing ?? 0 = ${missing ?? 0}")

    let alice = findEmail("alice")
    let carol = findEmail("carol")
    println("alice => ${alice ?? "not found"}")
    println("carol => ${carol ?? "not found"}")

    println("present.getOrThrow() = ${present.getOrThrow()}")
    return 0
}
