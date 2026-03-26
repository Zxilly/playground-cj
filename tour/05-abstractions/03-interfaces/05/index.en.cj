// Readable interface
interface Readable {
    func read(): String
}

// Writable interface
interface Writable {
    func write(data: String): Unit
}

// Composite interface: supports both reading and writing
interface ReadWrite <: Readable & Writable {
    // Can add new methods
    func clear(): Unit {
        // Provide default implementation
        println("Content cleared")
    }
}

// File buffer implements ReadWrite
class FileBuffer <: ReadWrite {
    var content: String = ""

    public func read(): String {
        if (content.isEmpty()) {
            "<empty>"
        } else {
            content
        }
    }

    public func write(data: String): Unit {
        content = data
    }

    public func clear(): Unit {
        content = ""
        println("Buffer cleared")
    }
}

// Network stream implements ReadWrite
class NetworkStream <: ReadWrite {
    var buffer: String = ""

    public func read(): String {
        buffer
    }

    public func write(data: String): Unit {
        buffer = data
        println("Data sent: ${data}")
    }
}

// Function to handle readable objects
func showContent(r: Readable) {
    println("Content: ${r.read()}")
}

// Function to handle writable objects
func writeData(w: Writable, data: String) {
    w.write(data)
}

main() {
    let buffer = FileBuffer()

    // Use as ReadWrite
    println("=== As ReadWrite ===")
    buffer.write("Hello, Cangjie!")
    println("Read: ${buffer.read()}")
    buffer.clear()

    // Can assign to parent interface types
    println("\n=== Subtype Conversion ===")
    let reader: Readable = buffer  // ReadWrite -> Readable
    let writer: Writable = buffer  // ReadWrite -> Writable

    writer.write("Interface inheritance example")
    showContent(reader)  // Use Readable interface

    // Multiple ReadWrite objects
    println("\n=== Heterogeneous Collection ===")
    let streams: Array<ReadWrite> = [
        FileBuffer(),
        NetworkStream()
    ]

    for (s in streams) {
        s.write("Test data")
        println("Read: ${s.read()}")
        println()
    }
}