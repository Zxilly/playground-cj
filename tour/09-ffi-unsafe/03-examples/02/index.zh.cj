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

// 映射 C 结构体：struct Config { int32_t id; double value; };
@C
struct Config {
    var id: Int32 = 0
    var value: Float64 = 0.0

    init(id: Int32, value: Float64) {
        this.id = id
        this.value = value
    }
}

main() {
    // 创建结构体实例
    let p = Point(10, 20)
    println("Point(${p.x}, ${p.y})")
    println("sizeOf<Point> = ${sizeOf<Point>()}")
    println("alignOf<Point> = ${alignOf<Point>()}")
    println()

    let r = Rect(3.5, 7.0)
    println("Rect(${r.w}, ${r.h})")
    println("sizeOf<Rect> = ${sizeOf<Rect>()}")
    println("alignOf<Rect> = ${alignOf<Rect>()}")
    println()

    let c = Config(1, 99.99)
    println("Config(id=${c.id}, value=${c.value})")
    println("sizeOf<Config> = ${sizeOf<Config>()}")
    println("alignOf<Config> = ${alignOf<Config>()}")
    println()

    // 嵌套结构体会被打平为连续内存
    println("Int64 大小: ${sizeOf<Int64>()}")
    println("Float32 大小: ${sizeOf<Float32>()}")
    println("Int32 大小: ${sizeOf<Int32>()}")
}