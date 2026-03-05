abstract class Shape {
    // Abstract methods - no implementation
    func area(): Float64
    func name(): String

    // Concrete method using abstract methods
    func describe(): String {
        "${name()}: area = ${area()}"
    }
}

class Circle <: Shape {
    let radius: Float64

    init(r: Float64) {
        this.radius = r
    }

    func area(): Float64 {
        3.14159 * radius * radius
    }

    func name(): String {
        "Circle(r=${radius})"
    }
}

class Rectangle <: Shape {
    let width: Float64
    let height: Float64

    init(w: Float64, h: Float64) {
        this.width = w
        this.height = h
    }

    func area(): Float64 {
        width * height
    }

    func name(): String {
        "Rectangle(${width}x${height})"
    }
}

main() {
    // Cannot instantiate: let s = Shape()  // Error!
    let shapes: Array<Shape> = [Circle(5.0), Rectangle(3.0, 4.0)]

    for (s in shapes) {
        println(s.describe())
    }
}