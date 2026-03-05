struct Pair<A, B> {
    let first: A
    let second: B

    public init(first: A, second: B) {
        this.first = first
        this.second = second
    }

    public func toString(): String {
        return "(${first}, ${second})"
    }
}

struct Point<T> {
    let x: T
    let y: T

    public init(x: T, y: T) {
        this.x = x
        this.y = y
    }

    public func toString(): String {
        return "Point(${x}, ${y})"
    }
}

main() {
    let p1 = Pair("name", 42)
    println("Pair: ${p1.toString()}")

    let p2 = Pair(true, "hello")
    println("Pair: ${p2.toString()}")

    let pt = Point(3.14, 2.72)
    println(pt.toString())
}