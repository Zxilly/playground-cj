struct Point {
    var x: Float64
    var y: Float64

    init(x: Float64, y: Float64) {
        this.x = x
        this.y = y
    }

    // 普通方法：只能读取字段
    func display(): String {
        "(${x}, ${y})"
    }

    // mut 方法：可以修改字段
    mut func translate(dx: Float64, dy: Float64) {
        x += dx
        y += dy
    }

    mut func scale(factor: Float64) {
        x *= factor
        y *= factor
    }

    mut func reset() {
        x = 0.0
        y = 0.0
    }
}

main() {
    // 必须用 var 声明才能调用 mut 方法
    var p = Point(1.0, 2.0)
    println("初始: ${p.display()}")

    p.translate(3.0, 4.0)
    println("平移后: ${p.display()}")

    p.scale(2.0)
    println("缩放后: ${p.display()}")

    p.reset()
    println("重置后: ${p.display()}")
}