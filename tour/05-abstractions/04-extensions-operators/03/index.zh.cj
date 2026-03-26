struct Rectangle {
    public let width: Float64
    public let height: Float64
    private let _tag: String  // 私有字段，扩展无法访问

    public init(width: Float64, height: Float64) {
        this.width = width
        this.height = height
        this._tag = "rectangle"
    }

    public func tag(): String {
        return this._tag
    }
}

// 扩展通过公开成员计算几何属性
extend Rectangle {
    // 计算面积
    func area(): Float64 {
        return this.width * this.height
    }

    // 计算周长
    func perimeter(): Float64 {
        return 2.0 * (this.width + this.height)
    }

    // 判断是否为正方形
    func isSquare(): Bool {
        return this.width == this.height
    }

    // 获取描述信息
    func describe(): String {
        let shape = if (this.isSquare()) { "正方形" } else { "矩形" }
        return "${shape}: ${this.width} x ${this.height}"
    }

    // 计算对角线长度
    func diagonal(): Float64 {
        return (this.width * this.width + this.height * this.height).sqrt()
    }
}

main() {
    let rect1 = Rectangle(5.0, 3.0)
    println(rect1.describe())
    println("  面积: ${rect1.area()}")
    println("  周长: ${rect1.perimeter()}")
    println("  对角线: ${rect1.diagonal()}")
    println()

    let rect2 = Rectangle(4.0, 4.0)
    println(rect2.describe())
    println("  面积: ${rect2.area()}")
    println("  是正方形: ${rect2.isSquare()}")
}