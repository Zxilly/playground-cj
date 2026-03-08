interface Readable {
    func read(): String
}

interface Writable {
    func write(data: String): Unit
}

interface ReadWrite <: Readable & Writable {}

class FileBuffer <: ReadWrite {
    var content: String = ""

    public func read(): String {
        content
    }

    public func write(data: String): Unit {
        content = data
    }
}

main() {
    let both: ReadWrite = FileBuffer()
    both.write("hello")

    let reader: Readable = both
    let writer: Writable = both
    writer.write("hello, interfaces")
    println(reader.read())
}
