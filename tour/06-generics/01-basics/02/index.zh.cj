// 泛型结构体：存储两个可能不同类型的值
struct Pair<T, U> {
    let first: T
    let second: U

    public init(first: T, second: U) {
        this.first = first
        this.second = second
    }

    public func firstValue(): T {
        first
    }

    public func secondValue(): U {
        second
    }

    // 返回一个新的 Pair，交换元素顺序
    public func swap(): Pair<U, T> {
        Pair<U, T>(second, first)
    }
}

main() {
    // 创建一个 Pair<String, Int64> 实例
    let pair1 = Pair<String, Int64>("成绩", 95)
    println("第一个: ${pair1.firstValue()}")
    println("第二个: ${pair1.secondValue()}")

    // 交换元素顺序
    let swapped = pair1.swap()
    println("交换后 - 第一个: ${swapped.firstValue()}")
    println("交换后 - 第二个: ${swapped.secondValue()}")

    // 创建另一个不同类型的 Pair
    let pair2 = Pair<Bool, String>(true, "已完成")
    println("状态: ${pair2.firstValue()}, 描述: ${pair2.secondValue()}")
}