// 可读接口
interface Readable {
    func read(): String
}

// 可写接口
interface Writable {
    func write(data: String): Unit
}

// 组合接口：同时支持读写
interface ReadWrite <: Readable & Writable {
    // 可以添加新的方法
    func clear(): Unit {
        // 提供默认实现
        println("内容已清空")
    }
}

// 文件缓冲区实现 ReadWrite
class FileBuffer <: ReadWrite {
    var content: String = ""

    public func read(): String {
        if (content.isEmpty()) {
            "<空>"
        } else {
            content
        }
    }

    public func write(data: String): Unit {
        content = data
    }

    public func clear(): Unit {
        content = ""
        println("缓冲区已清空")
    }
}

// 网络流实现 ReadWrite
class NetworkStream <: ReadWrite {
    var buffer: String = ""

    public func read(): String {
        buffer
    }

    public func write(data: String): Unit {
        buffer = data
        println("发送数据: ${data}")
    }
}

// 处理可读对象的函数
func showContent(r: Readable) {
    println("内容: ${r.read()}")
}

// 处理可写对象的函数  
func writeData(w: Writable, data: String) {
    w.write(data)
}

main() {
    let buffer = FileBuffer()

    // 作为 ReadWrite 使用
    println("=== 作为 ReadWrite ===")
    buffer.write("你好，仓颉!")
    println("读取: ${buffer.read()}")
    buffer.clear()

    // 可以赋值给父接口类型
    println("\n=== 子类型转换 ===")
    let reader: Readable = buffer  // ReadWrite -> Readable
    let writer: Writable = buffer  // ReadWrite -> Writable

    writer.write("接口继承示例")
    showContent(reader)  // 使用 Readable 接口

    // 多个 ReadWrite 对象
    println("\n=== 异构集合 ===")
    let streams: Array<ReadWrite> = [
        FileBuffer(),
        NetworkStream()
    ]

    for (s in streams) {
        s.write("测试数据")
        println("读取: ${s.read()}")
        println()
    }
}