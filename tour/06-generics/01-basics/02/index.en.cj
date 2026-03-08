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
}

main() {
    let pair = Pair<String, Int64>("score", 95)
    println(pair.firstValue())
    println(pair.secondValue())
}
