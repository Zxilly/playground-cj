// Map C struct: struct Point { int64_t x; int64_t y; };
@C
struct Point {
    var x: Int64 = 0
    var y: Int64 = 0

    init(x: Int64, y: Int64) {
        this.x = x
        this.y = y
    }
}

// Map C struct: struct Rect { float w; float h; };
@C
struct Rect {
    var w: Float32 = 0.0
    var h: Float32 = 0.0

    init(w: Float32, h: Float32) {
        this.w = w
        this.h = h
    }
}

// Map C struct: struct Config { int32_t id; double value; };
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
    // Create struct instances
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

    // Nested structs are flattened to contiguous memory
    println("Int64 size: ${sizeOf<Int64>()}")
    println("Float32 size: ${sizeOf<Float32>()}")
    println("Int32 size: ${sizeOf<Int32>()}")
}