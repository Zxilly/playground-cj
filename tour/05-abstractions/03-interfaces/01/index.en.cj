interface Printable {
    func display(): String
}

interface Named {
    func name(): String {
        "anonymous"
    }
}

class User <: Printable & Named {
    let username: String

    init(username: String) {
        this.username = username
    }

    public func display(): String {
        "user = ${username}"
    }

    public func name(): String {
        username
    }
}

main() {
    let user = User("alice")
    println(user.display())
    println(user.name())
}
