interface PrintableSize {
    func printSize(): Unit
}

extend<T> Array<T> <: PrintableSize {
    public func printSize(): Unit {
        println("size = ${this.size}")
    }
}

main(): Int64 {
    let values: PrintableSize = [1, 2, 3, 5, 8]
    values.printSize()
    return 0
}
