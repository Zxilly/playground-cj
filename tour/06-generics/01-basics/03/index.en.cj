import std.collection.ArrayList

class Stack<T> {
    let items = ArrayList<T>()

    public func push(item: T) {
        items.add(item)
    }

    public func pop(): T {
        let lastIndex = items.size - 1
        let value = items[lastIndex]
        items.remove(at: lastIndex)
        value
    }

    public func size(): Int64 {
        items.size
    }
}

main() {
    let stack = Stack<String>()
    stack.push("first")
    stack.push("second")
    println(stack.size())
    println(stack.pop())
}
