// @C 修饰 struct 使其内存布局与 C 兼容。
@C
struct Point {
    var x: Int64 = 0
    var y: Int64 = 0
}

// @C 修饰函数使其可以被 C 代码调用。
@C
func addPoints(a: Point, b: Point): Point {
    return Point(a.x + b.x, a.y + b.y)
}

main() {
    let p1 = Point(3, 4)
    let p2 = Point(10, 20)
    // @C 函数必须在 unsafe 块中调用。
    let result = unsafe { addPoints(p1, p2) }
    println("(${result.x}, ${result.y})")
}
