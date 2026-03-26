struct Rectangle {
    public let width: Float64
    public let height: Float64
    private let _tag: String  // Private field, inaccessible to extensions

    public init(width: Float64, height: Float64) {
        this.width = width
        this.height = height
        this._tag = "rectangle"
    }

    public func tag(): String {
        return this._tag
    }
}

// Extension calculates geometric properties through public members
extend Rectangle {
    // Calculate area
    func area(): Float64 {
        return this.width * this.height
    }

    // Calculate perimeter
    func perimeter(): Float64 {
        return 2.0 * (this.width + this.height)
    }

    // Check if it's a square
    func isSquare(): Bool {
        return this.width == this.height
    }

    // Get description
    func describe(): String {
        let shape = if (this.isSquare()) { "Square" } else { "Rectangle" }
        return "${shape}: ${this.width} x ${this.height}"
    }

    // Calculate diagonal length
    func diagonal(): Float64 {
        return (this.width * this.width + this.height * this.height).sqrt()
    }
}

main() {
    let rect1 = Rectangle(5.0, 3.0)
    println(rect1.describe())
    println("  Area: ${rect1.area()}")
    println("  Perimeter: ${rect1.perimeter()}")
    println("  Diagonal: ${rect1.diagonal()}")
    println()

    let rect2 = Rectangle(4.0, 4.0)
    println(rect2.describe())
    println("  Area: ${rect2.area()}")
    println("  Is square: ${rect2.isSquare()}")
}