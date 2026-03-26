import std.collection.HashMap

// 根据用户名查找邮箱
func findEmail(name: String): ?String {
    let users = HashMap<String, String>([
        ("alice", "alice@example.com"),
        ("bob", "bob@example.com")
    ])
    
    if (users.contains(name)) {
        return users[name]  // 自动包装为 Some
    }
    None
}

main() {
    // 使用 ?? 提供默认值
    let present: ?Int64 = Some(42)
    let missing: ?Int64 = None

    println("存在值 ?? 0 = ${present ?? 0}")
    println("空值 ?? 0 = ${missing ?? 0}")

    // 在实际场景中使用 ??
    let alice = findEmail("alice")
    let carol = findEmail("carol")

    println("alice => ${alice ?? "未找到"}")
    println("carol => ${carol ?? "未找到"}")

    // 使用 getOrThrow() 解包
    try {
        let email = alice.getOrThrow()
        println("alice 的邮箱: ${email}")
    } catch (e: NoneValueException) {
        println("无法获取邮箱")
    }

    // 对 None 使用 getOrThrow() 会抛出异常
    try {
        let email = carol.getOrThrow()
        println("carol 的邮箱: ${email}")
    } catch (e: NoneValueException) {
        println("carol 没有邮箱记录")
    }
}