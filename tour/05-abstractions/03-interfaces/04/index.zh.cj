// 定义绘图接口
interface Drawable {
    func draw(): String
    func area(): Float64
}

// 直线
class Line <: Drawable {
    let length: Float64

    init(length: Float64) {
        this.length = length
    }

    public func draw(): String {
        "绘制直线"
    }

    public func area(): Float64 {
        0.0  // 线没有面积
    }
}

// 圆形
class Circle <: Drawable {
    let radius: Float64

    init(radius: Float64) {
        this.radius = radius
    }

    public func draw(): String {
        "绘制半径为 ${radius} 的圆"
    }

    public func area(): Float64 {
        3.14159 * radius * radius
    }
}

// 矩形
class Rectangle <: Drawable {
    let width: Float64
    let height: Float64

    init(w: Float64, h: Float64) {
        this.width = w
        this.height = h
    }

    public func draw(): String {
        "绘制 ${width}x${height} 矩形"
    }

    public func area(): Float64 {
        width * height
    }
}

main() {
    // 接口数组可以存储不同类型的对象
    let drawings: Array<Drawable> = [
        Line(5.0),
        Circle(3.0),
        Rectangle(4.0, 5.0)
    ]

    println("=== 绘图系统 ===")
    var totalArea: Float64 = 0.0

    for (item in drawings) {
        println("操作: ${item.draw()}")
        let a = item.area()
        println("面积: ${a}")
        totalArea += a
        println()
    }

    println("总面积: ${totalArea}")

    // 接口变量可以重新赋值为不同的实现类型
    var shape: Drawable = Circle(2.0)
    println("\n当前图形: ${shape.draw()}")
    
    shape = Rectangle(3.0, 4.0)
    println("切换后: ${shape.draw()}")
}