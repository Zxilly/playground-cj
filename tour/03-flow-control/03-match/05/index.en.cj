interface Shape {}

open class Circle <: Shape {
    let radius: Int64

    init(radius: Int64) {
        this.radius = radius
    }
}

class Rectangle <: Shape {
    let width: Int64
    let height: Int64

    init(width: Int64, height: Int64) {
        this.width = width
        this.height = height
    }
}

func describe(shape: Shape): String {
    match (shape) {
        case circle: Circle => "circle radius = ${circle.radius}"
        case rectangle: Rectangle => "rectangle = ${rectangle.width} x ${rectangle.height}"
        case _ => "unknown"
    }
}

main() {
    println(describe(Circle(5)))
    println(describe(Rectangle(3, 4)))
}
