open class Shape

class Circle <: Shape {
    let radius: Float64
    init(r: Float64) {
        radius = r
    }
}

class Rectangle <: Shape {
    let width: Float64
    let height: Float64
    init(w: Float64, h: Float64) {
        width = w
        height = h
    }
}

main() {
    let shape: Shape = Circle(5.0)

    match (shape) {
        case c: Circle => println("圆形，半径: ${c.radius}")
        case r: Rectangle => println("矩形，宽: ${r.width}，高: ${r.height}")
        case _ => println("未知形状")
    }
}
