interface Shape {
    func area(): Int64
}

open class Circle <: Shape {
    let radius: Int64

    init(radius: Int64) {
        this.radius = radius
    }

    public func area(): Int64 {
        radius * radius * 3  // 简化计算
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
            "圆形，半径 ${c.radius}，面积 ${c.area()}"
        case r: Rectangle =>
            "矩形，宽 ${r.width} 高 ${r.height}，面积 ${r.area()}"
        case _ =>
            "未知形状"
    }
}

main() {
    let shapes: Array<Shape> = [Circle(5), Rectangle(3, 4)]
    for (shape in shapes) {
        println(describe(shape))
    }
}