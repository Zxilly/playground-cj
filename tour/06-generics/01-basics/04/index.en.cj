// Generic interface: defines a container for values
interface Container<T> {
    func get(): T
    func describe(): String
}

// Generic struct implements generic interface
struct Box<T> <: Container<T> {
    let value: T

    public init(value: T) {
        this.value = value
    }

    public func get(): T {
        value
    }

    public func describe(): String {
        "Box contains a value"
    }
}

// Another generic interface implementation
struct NamedBox<T> <: Container<T> {
    let value: T
    let name: String

    public init(value: T, name: String) {
        this.value = value
        this.name = name
    }

    public func get(): T {
        value
    }

    public func describe(): String {
        "${name} contains a value"
    }
}

// Function accepting generic interface as parameter
func showIntContainer(item: Container<Int64>) {
    println("Description: ${item.describe()}")
    println("Value: ${item.get()}")
}

func showStringContainer(item: Container<String>) {
    println("Description: ${item.describe()}")
    println("Value: ${item.get()}")
}

main() {
    // Create Container<Int64> instances
    let intBox = Box<Int64>(42)
    let intNamed = NamedBox<Int64>(100, "Counter")

    showIntContainer(intBox)
    showIntContainer(intNamed)

    println("---")

    // Create Container<String> instances
    let strBox = Box<String>("Cangjie")
    let strNamed = NamedBox<String>("Programming Language", "Language Name")

    showStringContainer(strBox)
    showStringContainer(strNamed)
}