import std.io.*

main() {
    // 创建内存流并写入字节数据
    let buffer = ByteBuffer()
    buffer.write("仓颉 I/O 流示例".toArray())
    buffer.write("\n第二行数据".toArray())

    // 读取数据：创建缓冲区，读取并转换为字符串
    let readBuf = Array<Byte>(64, repeat: 0)
    let bytesRead = buffer.read(readBuf)
    println("读到 ${bytesRead} 字节:")
    println(String.fromUtf8(readBuf[..bytesRead]))

    // 使用 StringReader 逐行读取文本
    let buffer2 = ByteBuffer()
    buffer2.write("第一行\n第二行\n第三行".toArray())
    let reader = StringReader(buffer2)

    println("\n逐行读取:")
    var line = reader.readln()
    while (line != None) {
        println(line ?? "")
        line = reader.readln()
    }
}