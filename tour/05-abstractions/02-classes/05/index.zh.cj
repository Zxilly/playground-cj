open class Shape {
    // open 允许子类重写
    public open func area(): Float64 {
        0.0
    }

    public open func label(): String {
        "图形"
    }

    // 普通方法可以调用 open 方法（动态分派）
    public func describe(): String {
        "${label()} 的面积 = ${area()}"
    }
}

class Circle <: Shape {
    let radius: Float64

    public init(radius: Float64) {
        this.radius = radius
    }

    // override 重写父类方法
    public override func area(): Float64 {
        3.14159 * radius * radius
    }

    public override func label(): String {
        "圆形"
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
        "方形"
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
        "三角形"
    }
}

main() {
    // 存储不同子类对象
    let shapes: Array<Shape> = [
        Circle(2.0),
        Square(3.0),
        Triangle(4.0, 3.0)
    ]

    // 多态：每个对象调用各自的实现
    for (shape in shapes) {
        // describe() 调用 area() 和 label() 时
        // 运行时分派到子类的版本
        println(shape.describe())
    }

    println("\n直接调用:")
    let c = Circle(1.0)
    println("半径 1 的圆面积: ${c.area()}")
}