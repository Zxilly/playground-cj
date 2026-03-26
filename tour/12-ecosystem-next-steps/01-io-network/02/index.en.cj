import std.net.*
import std.sync.*
import std.time.*

// TCP Server: bind to port, wait for client connections
func runServer(port: UInt16): Unit {
    try (server = TcpServerSocket(bindAt: port)) {
        server.bind()
        println("Server listening on port: ${port}")

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
}

main() {
    let port: UInt16 = 9999

    // Start server in another thread
    let serverFuture = spawn {
        runServer(port)
    }

    // Wait for server to start
    sleep(Duration.millisecond * 100)

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