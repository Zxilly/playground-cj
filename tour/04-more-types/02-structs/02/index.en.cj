struct Rectangle {
    var width: Float64
    var height: Float64

    // Primary constructor: create a regular rectangle
    init(width: Float64, height: Float64) {
        this.width = width
        this.height = height
    }

    // Overloaded constructor: create a square
    init(side: Float64) {
        this.width = side
        this.height = side
    }

    func area(): Float64 {
        width * height
    }
}

main() {
    // Create instances using different constructors
    let rect = Rectangle(10.0, 5.0)
    println("Rectangle: ${rect.width} x ${rect.height}")
    println("Area: ${rect.area()}")

    let square = Rectangle(7.0)
    println("Square: ${square.width} x ${square.height}")
    println("Area: ${square.area()}")

    // Value semantics: assignment creates a copy
    var a = Rectangle(3.0, 4.0)
    var b = a           // b is an independent copy of a
    b.width = 100.0     // modifying b does not affect a

    println("--- Value Semantics Verification ---")
    println("a.width = ${a.width}")   // 3.0, remains unchanged
    println("b.width = ${b.width}")   // 100.0
}