// Generic struct: stores two values of possibly different types
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

    // Return a new Pair with swapped element order
    public func swap(): Pair<U, T> {
        Pair<U, T>(second, first)
    }
}

main() {
    // Create a Pair<String, Int64> instance
    let pair1 = Pair<String, Int64>("Score", 95)
    println("First: ${pair1.firstValue()}")
    println("Second: ${pair1.secondValue()}")

    // Swap element order
    let swapped = pair1.swap()
    println("After swap - First: ${swapped.firstValue()}")
    println("After swap - Second: ${swapped.secondValue()}")

    // Create another Pair of different type
    let pair2 = Pair<Bool, String>(true, "Completed")
    println("Status: ${pair2.firstValue()}, Description: ${pair2.secondValue()}")
}