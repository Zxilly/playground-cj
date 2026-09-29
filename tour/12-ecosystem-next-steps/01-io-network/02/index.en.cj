import std.net.*

// TCP server: accept a connection and reply
func runServer(server: TcpServerSocket): Unit {
    // Accept client connection
    try (client = server.accept()) {
        println("Client connected")

        // Read data sent by client
        let buf = Array<Byte>(64, repeat: 0)
        let count = client.read(buf)
        let msg = String.fromUtf8(buf[..count])
        println("Received message: ${msg}")

        // Reply to client
        client.write("Server received: ${msg}".toArray())
    }
}

main() {
    // Bind an available port before connecting; no fixed port or startup sleep.
    try (server = TcpServerSocket(bindAt: 0)) {
        server.bind()
        let port = (server.localAddress as IPSocketAddress)?.port ?? throw Exception("Missing IP address")
        let serverFuture = spawn { runServer(server) }

        // Client connects and sends message
        try (socket = TcpSocket("127.0.0.1", port)) {
            socket.connect()
            socket.write("Hello, Cangjie network programming!".toArray())

            // Read server reply
            let buf = Array<Byte>(64, repeat: 0)
            let count = socket.read(buf)
            println(String.fromUtf8(buf[..count]))
        }

        serverFuture.get()
    }
}
