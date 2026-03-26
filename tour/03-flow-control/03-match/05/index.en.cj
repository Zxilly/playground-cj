interface Shape {
    func area(): Int64
}

open class Circle <: Shape {
    let radius: Int64

    init(radius: Int64) {
        this.radius = radius
    }

    public func area(): Int64 {
        radius * radius * 3  // Simplified calculation
    }
}

class Rectangle <: Shape {
    let width: Int64
    let height: Int64

    init(width: Int64, height: Int64) {
        this.width = width
        this.height = height
    }

    public func area(): Int64 {
        width * height
    }
}

func describe(shape: Shape): String {
    match (shape) {
        case c: Circle =>
            "Circle, radius ${c.radius}, area ${c.area()}"
        case r: Rectangle =>
            "Rectangle, width ${r.width} height ${r.height}, area ${r.area()}"
        case _ =>
            "Unknown shape"
    }
}

main() {
    let shapes: Array<Shape> = [Circle(5), Rectangle(3, 4)]
    for (shape in shapes) {
        println(describe(shape))
    }
}