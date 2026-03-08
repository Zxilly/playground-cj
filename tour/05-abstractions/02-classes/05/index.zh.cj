open class Shape {
    public open func area(): Float64 {
        0.0
    }

    public open func label(): String {
        "Shape"
    }

    public func describe(): String {
        "${label()} area = ${area()}"
    }
}

class Circle <: Shape {
    let radius: Float64

    init(radius: Float64) {
        this.radius = radius
    }

    public override func area(): Float64 {
        3.14159 * radius * radius
    }

    public override func label(): String {
        "Circle"
    }
}

class Square <: Shape {
    let side: Float64

    init(side: Float64) {
        this.side = side
    }

    public override func area(): Float64 {
        side * side
    }

    public override func label(): String {
        "Square"
    }
}

main() {
    let shapes: Array<Shape> = [Circle(2.0), Square(3.0)]
    for (shape in shapes) {
        println(shape.describe())
    }
}
