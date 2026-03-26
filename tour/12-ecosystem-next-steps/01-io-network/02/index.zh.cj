import std.net.*
import std.sync.*
import std.time.*

// TCP 服务端：绑定端口，等待客户端连接
func runServer(port: UInt16): Unit {
    try (server = TcpServerSocket(bindAt: port)) {
        server.bind()
        println("服务端监听端口: ${port}")

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
}

main() {
    let port: UInt16 = 9999

    // 在另一个线程启动服务端
    let serverFuture = spawn {
        runServer(port)
    }

    // 等待服务端启动
    sleep(Duration.millisecond * 100)

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