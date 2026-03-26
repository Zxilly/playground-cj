struct Circle {
    let radius: Float64

    init(radius: Float64) {
        this.radius = radius
    }

    // 计算面积
    func area(): Float64 {
        3.14159 * radius * radius
    }

    // 计算周长
    func circumference(): Float64 {
        2.0 * 3.14159 * radius
    }

    // 返回描述字符串
    func describe(): String {
        "Circle(r=${radius})"
    }

    // 比较两个圆的大小
    func isLargerThan(other: Circle): Bool {
        this.area() > other.area()
    }
}

main() {
    let c1 = Circle(5.0)
    let c2 = Circle(3.0)

    println(c1.describe())
    println("面积: ${c1.area()}")
    println("周长: ${c1.circumference()}")

    let larger = if (c1.isLargerThan(c2)) { "c1" } else { "c2" }
    println("较大的圆: ${larger}")
}