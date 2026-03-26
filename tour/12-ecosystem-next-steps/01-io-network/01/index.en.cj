import std.io.*

main() {
    // Create a memory stream and write byte data
    let buffer = ByteBuffer()
    buffer.write("Cangjie I/O Stream Example".toArray())
    buffer.write("\nSecond line of data".toArray())

    // Read data: create buffer, read and convert to string
    let readBuf = Array<Byte>(64, repeat: 0)
    let bytesRead = buffer.read(readBuf)
    println("Read ${bytesRead} bytes:")
    println(String.fromUtf8(readBuf[..bytesRead]))

    // Use StringReader to read text line by line
    let buffer2 = ByteBuffer()
    buffer2.write("First line\nSecond line\nThird line".toArray())
    let reader = StringReader(buffer2)

    println("\nReading line by line:")
    var line = reader.readln()
    while (line != None) {
        println(line ?? "")
        line = reader.readln()
    }
}