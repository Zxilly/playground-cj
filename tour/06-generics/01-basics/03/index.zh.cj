import std.collection.ArrayList

// 泛型类：实现一个简单的栈结构
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
    // 创建一个 Stack<Int64> 实例
    let intStack = Stack<Int64>()
    intStack.push(10)
    intStack.push(20)
    intStack.push(30)

    println("栈大小: ${intStack.size()}")
    println("栈顶元素: ${intStack.peek()}")

    // 弹出元素
    match (intStack.pop()) {
        case Some(value) => println("弹出: ${value}")
        case None => println("栈为空")
    }

    println("弹出后大小: ${intStack.size()}")

    // 创建一个 Stack<String> 实例
    let strStack = Stack<String>()
    strStack.push("仓颉")
    strStack.push("编程语言")

    match (strStack.pop()) {
        case Some(value) => println("弹出字符串: ${value}")
        case None => println("栈为空")
    }
}