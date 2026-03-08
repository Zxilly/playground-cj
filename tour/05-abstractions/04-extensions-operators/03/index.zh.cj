struct Rectangle {
    let width: Float64
    let height: Float64

    public init(width: Float64, height: Float64) {
        this.width = width
        this.height = height
    }
}

// Extension can access public members
extend Rectangle {
    func area(): Float64 {
        return this.width * this.height
    }

    func perimeter(): Float64 {
        return 2.0 * (this.width + this.height)
    }

    func isSquare(): Bool {
        return this.width == this.height
    }

    func describe(): String {
        return "Rectangle(${this.width} x ${this.height})"
    }
}

main() {
    let rect = Rectangle(5.0, 3.0)
    println(rect.describe())
    println("Area: ${rect.area()}")
    println("Perimeter: ${rect.perimeter()}")
    println("Is square: ${rect.isSquare()}")

    let square = Rectangle(4.0, 4.0)
    println(square.describe())
    println("Is square: ${square.isSquare()}")
}
