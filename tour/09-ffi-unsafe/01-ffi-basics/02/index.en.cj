// @C on a struct makes its memory layout C-compatible.
@C
struct Point {
    var x: Int64 = 0
    var y: Int64 = 0
}

// @C on a function makes it callable from C code.
@C
func addPoints(a: Point, b: Point): Point {
    return Point(a.x + b.x, a.y + b.y)
}

main() {
    let p1 = Point(3, 4)
    let p2 = Point(10, 20)
    // @C functions must be called in an unsafe block.
    let result = unsafe { addPoints(p1, p2) }
    println("(${result.x}, ${result.y})")
}
