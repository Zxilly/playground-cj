open class Shape {
    open func area(): Float64 {
        0.0
    }

    open func name(): String {
        "Shape"
    }

    func describe(): String {
        "${name()}: area = ${area()}"
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

    public override func name(): String {
        "Circle(r=${radius})"
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

    public override func name(): String {
        "Square(s=${side})"
    }
}

main() {
    let shapes: Array<Shape> = [Circle(5.0), Square(4.0), Circle(3.0)]

    for (s in shapes) {
        println(s.describe())
    }
}