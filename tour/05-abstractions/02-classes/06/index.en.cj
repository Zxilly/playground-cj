// Abstract class: cannot be instantiated
abstract class Shape {
    // Abstract methods: no function body
    public func area(): Float64
    public func label(): String

    // Concrete method: can call abstract methods
    public func describe(): String {
        "Area of ${label()} = ${area()}"
    }

    // Can contain member variables
    public func color(): String {
        "White"  // Default color
    }
}

// Concrete subclass: must implement all abstract methods
class Circle <: Shape {
    let radius: Float64

    public init(radius: Float64) {
        this.radius = radius
    }

    public func area(): Float64 {
        3.14159 * radius * radius
    }

    public func label(): String {
        "Circle"
    }
}

class Rectangle <: Shape {
    let width: Float64
    let height: Float64

    public init(width: Float64, height: Float64) {
        this.width = width
        this.height = height
    }

    public func area(): Float64 {
        width * height
    }

    public func label(): String {
        "Rectangle"
    }

    // Can override concrete methods
    public override func color(): String {
        "Blue"
    }
}

main() {
    let shapes: Array<Shape> = [
        Circle(2.0),
        Rectangle(3.0, 4.0)
    ]

    println("Various shapes:")
    for (shape in shapes) {
        println(shape.describe())
        println("  Color: ${shape.color()}")
    }

    println("\nUsing individually:")
    let circle = Circle(5.0)
    println("Circle with radius 5:")
    println("  ${circle.describe()}")
    println("  Label: ${circle.label()}")
    println("  Color: ${circle.color()}")

    // Error example: abstract class cannot be instantiated
    // let shape = Shape()  // Compile error!
}