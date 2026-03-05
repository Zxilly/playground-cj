struct Point {
    let x: Float64
    let y: Float64

    init(x: Float64, y: Float64) {
        this.x = x
        this.y = y
    }

    public func toString(): String {
        "(${x}, ${y})"
    }
}

struct Color {
    let r: Int64
    let g: Int64
    let b: Int64

    init(r: Int64, g: Int64, b: Int64) {
        this.r = r
        this.g = g
        this.b = b
    }
}

main() {
    let p = Point(3.0, 4.0)
    println("Point: ${p.toString()}")
    println("x = ${p.x}, y = ${p.y}")

    let c = Color(255, 128, 0)
    println("Color: rgb(${c.r}, ${c.g}, ${c.b})")
}