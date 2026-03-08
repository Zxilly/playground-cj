import std.io.*

main() {
    // Write bytes into an in-memory buffer
    let buf = ByteBuffer()
    buf.write("Hello, Cangjie I/O!".toArray())

    // Read the bytes back from the buffer
    let data = Array<Byte>(64, repeat: 0)
    let n = buf.read(data)
    println(String.fromUtf8(data[..n]))

    // Use StringReader for line-based reading
    let buf2 = ByteBuffer()
    buf2.write("Line 1\nLine 2\nLine 3".toArray())
    let reader = StringReader(buf2)
    println(reader.readln() ?? "")
    println(reader.readln() ?? "")
}
