interface Container<T> {
    func get(): T
    func put(item: T): Unit
    func isEmpty(): Bool
}

class Box<T> <: Container<T> {
    var value: Option<T> = None

    public func get(): T {
        return value.getOrThrow()
    }

    public func put(item: T): Unit {
        value = Some(item)
    }

    public func isEmpty(): Bool {
        return value.isNone()
    }
}

func printContainer<T>(c: Container<T>): Unit {
    if (c.isEmpty()) {
        println("Container is empty")
    } else {
        println("Container holds: ${c.get()}")
    }
}

main() {
    let intBox = Box<Int64>()
    printContainer(intBox)

    intBox.put(42)
    printContainer(intBox)

    let strBox = Box<String>()
    strBox.put("Hello Generics")
    printContainer(strBox)
}