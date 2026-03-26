class Point {
    public let x: Int64
    public let y: Int64

    public init(x: Int64, y: Int64) {
        this.x = x
        this.y = y
    }

    // 重载一元 - 运算符：取反
    public operator func -(): Point {
        return Point(-this.x, -this.y)
    }

    // 重载二元 + 运算符：点相加
    public operator func +(right: Point): Point {
        return Point(this.x + right.x, this.y + right.y)
    }

    // 重载二元 - 运算符：点相减
    public operator func -(right: Point): Point {
        return Point(this.x - right.x, this.y - right.y)
    }

    // 重载二元 * 运算符：点与标量相乘
    public operator func *(scalar: Int64): Point {
        return Point(this.x * scalar, this.y * scalar)
    }

    // 格式化输出
    public func toString(): String {
        return "(${this.x}, ${this.y})"
    }
}

main() {
    let p1 = Point(2, 3)
    let p2 = Point(10, 20)

    println("p1 = ${p1.toString()}")
    println("p2 = ${p2.toString()}")
    println()

    // 使用重载的运算符
    let sum = p1 + p2
    println("p1 + p2 = ${sum.toString()}")

    let diff = p2 - p1
    println("p2 - p1 = ${diff.toString()}")

    let neg = -p1
    println("-p1 = ${neg.toString()}")

    let scaled = p1 * 3
    println("p1 * 3 = ${scaled.toString()}")

    // 组合运算
    let result = p1 + p2 * 2
    println("p1 + p2 * 2 = ${result.toString()}")
}