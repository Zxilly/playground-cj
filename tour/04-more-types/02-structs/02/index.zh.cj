struct Rectangle {
    var width: Float64
    var height: Float64

    // 主构造器：创建普通矩形
    init(width: Float64, height: Float64) {
        this.width = width
        this.height = height
    }

    // 重载构造器：创建正方形
    init(side: Float64) {
        this.width = side
        this.height = side
    }

    func area(): Float64 {
        width * height
    }
}

main() {
    // 使用不同构造器创建实例
    let rect = Rectangle(10.0, 5.0)
    println("矩形: ${rect.width} x ${rect.height}")
    println("面积: ${rect.area()}")

    let square = Rectangle(7.0)
    println("正方形: ${square.width} x ${square.height}")
    println("面积: ${square.area()}")

    // 值语义：赋值会创建副本
    var a = Rectangle(3.0, 4.0)
    var b = a           // b 是 a 的独立副本
    b.width = 100.0     // 修改 b 不影响 a

    println("--- 值语义验证 ---")
    println("a.width = ${a.width}")   // 3.0，保持不变
    println("b.width = ${b.width}")   // 100.0
}