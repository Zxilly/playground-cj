interface Container<T> {
    func get(): T
}

struct Box<T> <: Container<T> {
    let value: T

    public init(value: T) {
        this.value = value
    }

    public func get(): T {
        value
    }
}

func showIntBox(item: Container<Int64>) {
    println(item.get())
}

main() {
    showIntBox(Box<Int64>(42))
}
