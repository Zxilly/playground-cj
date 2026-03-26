open class Shape {
    // open allows subclasses to override
    public open func area(): Float64 {
        0.0
    }

    public open func label(): String {
        "Shape"
    }

    // Regular methods can call open methods (dynamic dispatch)
    public func describe(): String {
        "Area of ${label()} = ${area()}"
    }
}

class Circle <: Shape {
    let radius: Float64

    public init(radius: Float64) {
        this.radius = radius
    }

    // override to override parent method
    public override func area(): Float64 {
        3.14159 * radius * radius
    }

    public override func label(): String {
        "Circle"
    }
}

class Square <: Shape {
    let side: Float64

    public init(side: Float64) {
        this.side = side
    }

    public override func area(): Float64 {
        side * side
    }

    public override func label(): String {
        "Square"
    }
}

class Triangle <: Shape {
    let base: Float64
    let height: Float64

    public init(base: Float64, height: Float64) {
        this.base = base
        this.height = height
    }

    public override func area(): Float64 {
        0.5 * base * height
    }

    public override func label(): String {
        "Triangle"
    }
}

main() {
    // Store different subclass objects
    let shapes: Array<Shape> = [
        Circle(2.0),
        Square(3.0),
        Triangle(4.0, 3.0)
    ]

    // Polymorphism: each object calls its own implementation
    for (shape in shapes) {
        // When describe() calls area() and label()
        // runtime dispatches to subclass versions
        println(shape.describe())
    }

    println("\nDirect call:")
    let c = Circle(1.0)
    println("Area of circle with radius 1: ${c.area()}")
}