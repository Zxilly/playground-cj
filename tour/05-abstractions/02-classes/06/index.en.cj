abstract class Shape {
    public func area(): Float64
    public func label(): String

    public func describe(): String {
        "${label()} area = ${area()}"
    }
}

class Circle <: Shape {
    let radius: Float64

    init(radius: Float64) {
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

    init(width: Float64, height: Float64) {
        this.width = width
        this.height = height
    }

    public func area(): Float64 {
        width * height
    }

    public func label(): String {
        "Rectangle"
    }
}

main() {
    let shapes: Array<Shape> = [Circle(2.0), Rectangle(3.0, 4.0)]
    for (shape in shapes) {
        println(shape.describe())
    }
}
