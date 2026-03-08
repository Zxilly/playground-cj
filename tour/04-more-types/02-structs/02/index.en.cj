struct Rectangle {
    var width: Float64
    var height: Float64

    // Primary constructor
    init(width: Float64, height: Float64) {
        this.width = width
        this.height = height
    }

    // Constructor for a square
    init(side: Float64) {
        this.width = side
        this.height = side
    }

    func area(): Float64 {
        width * height
    }
}

main() {
    let rect = Rectangle(10.0, 5.0)
    println("Rectangle: ${rect.width} x ${rect.height}")
    println("Area: ${rect.area()}")

    let square = Rectangle(7.0)
    println("Square: ${square.width} x ${square.height}")
    println("Area: ${square.area()}")

    // Value type copy behavior
    var a = Rectangle(3.0, 4.0)
    var b = a  // b is a copy
    b.width = 100.0
    println("a.width = ${a.width}")  // unchanged
    println("b.width = ${b.width}")  // modified
}
