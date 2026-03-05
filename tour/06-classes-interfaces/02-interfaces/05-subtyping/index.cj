interface Readable {
    func read(): String
}

interface Writable {
    func write(data: String): Unit
}

// Interface extending other interfaces
interface ReadWritable <: Readable & Writable {}

class File <: ReadWritable {
    var content: String

    init() {
        this.content = ""
    }

    func read(): String {
        content
    }

    func write(data: String) {
        content = data
    }
}

// Accepts any Readable
func printContent(r: Readable) {
    println("Content: ${r.read()}")
}

// Accepts any Writable
func writeData(w: Writable, data: String) {
    w.write(data)
}

main() {
    let file = File()

    // File is a subtype of Writable, Readable, and ReadWritable
    writeData(file, "Hello, Cangjie!")
    printContent(file)

    let rw: ReadWritable = file
    rw.write("Updated content")
    println("Via ReadWritable: ${rw.read()}")
}