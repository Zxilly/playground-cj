struct Vec2 {
    let x: Float64
    let y: Float64

    public init(x: Float64, y: Float64) {
        this.x = x
        this.y = y
    }

    operator func +(rhs: Vec2): Vec2 {
        return Vec2(this.x + rhs.x, this.y + rhs.y)
    }

    operator func -(rhs: Vec2): Vec2 {
        return Vec2(this.x - rhs.x, this.y - rhs.y)
    }

    operator func *(scalar: Float64): Vec2 {
        return Vec2(this.x * scalar, this.y * scalar)
    }

    func length(): Float64 {
        return (this.x * this.x + this.y * this.y).toString().size.toFloat64()
        // Simplified: just show the components
    }

    func toString(): String {
        return "(${this.x}, ${this.y})"
    }
}

main() {
    let a = Vec2(1.0, 2.0)
    let b = Vec2(3.0, 4.0)

    let sum = a + b
    println("a = ${a.toString()}")
    println("b = ${b.toString()}")
    println("a + b = ${sum.toString()}")

    let diff = a - b
    println("a - b = ${diff.toString()}")

    let scaled = a * 3.0
    println("a * 3 = ${scaled.toString()}")
}