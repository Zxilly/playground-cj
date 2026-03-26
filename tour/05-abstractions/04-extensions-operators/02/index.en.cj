// Define interface
interface PrintableSize {
    func printSize(): Unit
    func printInfo(): Unit
}

// Make Array implement the interface through extension
extend<T> Array<T> <: PrintableSize {
    public func printSize(): Unit {
        println("Array size: ${this.size}")
    }

    public func printInfo(): Unit {
        println("This is an array containing ${this.size} elements")
    }
}

// Another interface example
interface Summable {
    func sum(): Int64
}

// Implement summable interface for Array<Int64>
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
    // Use as interface type
    let arr1: PrintableSize = [1, 2, 3, 4, 5]
    arr1.printSize()
    arr1.printInfo()

    println()

    // Another array
    let arr2: PrintableSize = ["hello", "world", "Cangjie"]
    arr2.printSize()
    arr2.printInfo()

    println()

    // Use as Summable
    let numbers: Array<Int64> = [10, 20, 30, 40]
    let s = numbers.sum()
    println("Sum of array [10, 20, 30, 40]: ${s}")
}