// 映射 C 结构体：struct Point { int64_t x; int64_t y; };
@C
struct Point {
    var x: Int64 = 0
    var y: Int64 = 0

    init(x: Int64, y: Int64) {
        this.x = x
        this.y = y
    }
}

// 映射 C 结构体：struct Rect { float w; float h; };
@C
struct Rect {
    var w: Float32 = 0.0
    var h: Float32 = 0.0

    init(w: Float32, h: Float32) {
        this.w = w
        this.h = h
    }
}

main() {
    let p = Point(10, 20)
    println("Point(${p.x}, ${p.y})")
    println("sizeOf<Point> = ${sizeOf<Point>()}")

    let r = Rect(3.5, 7.0)
    println("Rect(${r.w}, ${r.h})")
    println("sizeOf<Rect> = ${sizeOf<Rect>()}")
}
