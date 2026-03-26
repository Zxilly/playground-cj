// 定义接口
interface PrintableSize {
    func printSize(): Unit
    func printInfo(): Unit
}

// 通过扩展让 Array 实现接口
extend<T> Array<T> <: PrintableSize {
    public func printSize(): Unit {
        println("数组大小: ${this.size}")
    }

    public func printInfo(): Unit {
        println("这是一个包含 ${this.size} 个元素的数组")
    }
}

// 另一个接口示例
interface Summable {
    func sum(): Int64
}

// 为 Array<Int64> 实现求和接口
extend Array<Int64> <: Summable {
    public func sum(): Int64 {
        var total: Int64 = 0
        for (item in this) {
            total += item
        }
        return total
    }
}

main() {
    // 作为接口类型使用
    let arr1: PrintableSize = [1, 2, 3, 4, 5]
    arr1.printSize()
    arr1.printInfo()

    println()

    // 另一个数组
    let arr2: PrintableSize = ["hello", "world", "仓颉"]
    arr2.printSize()
    arr2.printInfo()

    println()

    // 作为 Summable 使用
    let numbers: Array<Int64> = [10, 20, 30, 40]
    let s = numbers.sum()
    println("数组 [10, 20, 30, 40] 的和: ${s}")
}