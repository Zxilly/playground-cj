// 抽象类：不能实例化
abstract class Shape {
    // 抽象方法：没有函数体
    public func area(): Float64
    public func label(): String

    // 具体方法：可以调用抽象方法
    public func describe(): String {
        "${label()} 的面积 = ${area()}"
    }

    // 可以包含成员变量
    public func color(): String {
        "白色"  // 默认颜色
    }
}

// 具体子类：必须实现所有抽象方法
class Circle <: Shape {
    let radius: Float64

    public init(radius: Float64) {
        this.radius = radius
    }

    public func area(): Float64 {
        3.14159 * radius * radius
    }

    public func label(): String {
        "圆形"
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
        "矩形"
    }

    // 可以重写具体方法
    public override func color(): String {
        "蓝色"
    }
}

main() {
    let shapes: Array<Shape> = [
        Circle(2.0),
        Rectangle(3.0, 4.0)
    ]

    println("各种形状:")
    for (shape in shapes) {
        println(shape.describe())
        println("  颜色: ${shape.color()}")
    }

    println("\n单独使用:")
    let circle = Circle(5.0)
    println("半径 5 的圆:")
    println("  ${circle.describe()}")
    println("  标签: ${circle.label()}")
    println("  颜色: ${circle.color()}")

    // 错误示例：抽象类无法实例化
    // let shape = Shape()  // 编译错误！
}