import std.collection.ArrayList

// Generic class: implements a simple stack structure
class Stack<T> {
    let items = ArrayList<T>()

    public func push(item: T) {
        items.add(item)
    }

    public func pop(): ?T {
        if (items.size == 0) {
            return None
        }
        let lastIndex = items.size - 1
        let value = items[lastIndex]
        items.remove(at: lastIndex)
        return Some(value)
    }

    public func peek(): ?T {
        if (items.size == 0) {
            return None
        }
        return Some(items[items.size - 1])
    }

    public func size(): Int64 {
        items.size
    }

    public func isEmpty(): Bool {
        items.size == 0
    }
}

main() {
    // Create a Stack<Int64> instance
    let intStack = Stack<Int64>()
    intStack.push(10)
    intStack.push(20)
    intStack.push(30)

    println("Stack size: ${intStack.size()}")
    println("Top element: ${intStack.peek()}")

    // Pop element
    match (intStack.pop()) {
        case Some(value) => println("Popped: ${value}")
        case None => println("Stack is empty")
    }

    println("Size after pop: ${intStack.size()}")

    // Create a Stack<String> instance
    let strStack = Stack<String>()
    strStack.push("Cangjie")
    strStack.push("Programming Language")

    match (strStack.pop()) {
        case Some(value) => println("Popped string: ${value}")
        case None => println("Stack is empty")
    }
}