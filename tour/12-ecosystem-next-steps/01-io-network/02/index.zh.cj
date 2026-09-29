import std.net.*

// TCP 服务端：接受连接并回复消息
func runServer(server: TcpServerSocket): Unit {
    // 接受客户端连接
    try (client = server.accept()) {
        println("客户端已连接")

        // 读取客户端发送的数据
        let buf = Array<Byte>(64, repeat: 0)
        let count = client.read(buf)
        let msg = String.fromUtf8(buf[..count])
        println("收到消息: ${msg}")

        // 向客户端回复
        client.write("服务端收到: ${msg}".toArray())
    }
}

main() {
    // 先绑定空闲端口，避免端口冲突和依赖 sleep 的启动竞态。
    try (server = TcpServerSocket(bindAt: 0)) {
        server.bind()
        let port = (server.localAddress as IPSocketAddress)?.port ?? throw Exception("Missing IP address")
        let serverFuture = spawn { runServer(server) }

        // 客户端连接并发送消息
        try (socket = TcpSocket("127.0.0.1", port)) {
            socket.connect()
            socket.write("你好，仓颉网络编程！".toArray())

            // 读取服务端回复
            let buf = Array<Byte>(64, repeat: 0)
            let count = socket.read(buf)
            println(String.fromUtf8(buf[..count]))
        }

        serverFuture.get()
    }
}
