func greet(name!: String, greeting!: String = "Hello") {
    println("${greeting}, ${name}!")
}

func connect(host!: String, port!: Int64 = 8080, secure!: Bool = false) {
    let scheme = if (secure) { "https" } else { "http" }
    println("Connecting to ${scheme}://${host}:${port}")
}

main() {
    greet(name: "Alice")
    greet(name: "Bob", greeting: "Hi")
    greet(name: "Charlie", greeting: "Hey")

    println("---")

    connect(host: "example.com")
    connect(host: "example.com", port: 443, secure: true)
    connect(host: "localhost", port: 3000)
}