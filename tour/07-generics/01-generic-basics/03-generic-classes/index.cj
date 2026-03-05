import std.collection.*

class Stack<T> {
    let items = ArrayList<T>()

    public func push(item: T): Unit {
        items.append(item)
    }

    public func pop(): T {
        return items.remove(items.size - 1)
    }

    public func peek(): T {
        return items[items.size - 1]
    }

    public func isEmpty(): Bool {
        return items.size == 0
    }

    public func size(): Int64 {
        return items.size
    }
}

main() {
    let stack = Stack<Int64>()
    stack.push(10)
    stack.push(20)
    stack.push(30)

    println("Top: ${stack.peek()}")
    println("Size: ${stack.size()}")

    let popped = stack.pop()
    println("Popped: ${popped}")
    println("New top: ${stack.peek()}")

    // String stack
    let names = Stack<String>()
    names.push("Alice")
    names.push("Bob")
    println("Name: ${names.pop()}")
}