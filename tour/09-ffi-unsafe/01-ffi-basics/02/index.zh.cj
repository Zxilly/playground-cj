// @C 修饰 struct 使其内存布局与 C 兼容
@C
struct Point {
    var x: Int64 = 0
    var y: Int64 = 0
    
    init(x: Int64, y: Int64) {
        this.x = x
        this.y = y
    }
}

// @C 修饰函数使其可以被 C 代码调用
// 调用 @C 函数同样需要在 unsafe 上下文中
@C
func addPoints(a: Point, b: Point): Point {
    return Point(a.x + b.x, a.y + b.y)
}

@C
func distanceSquared(p: Point): Int64 {
    return p.x * p.x + p.y * p.y
}

main() {
    let p1 = Point(3, 4)
    let p2 = Point(10, 20)
    
    // @C 函数必须在 unsafe 块中调用
    let sum = unsafe { addPoints(p1, p2) }
    println("点之和: (${sum.x}, ${sum.y})")
    
    let dist1 = unsafe { distanceSquared(p1) }
    println("p1 到原点距离的平方: ${dist1}")
    
    let dist2 = unsafe { distanceSquared(p2) }
    println("p2 到原点距离的平方: ${dist2}")
    
    // @C struct 可以像普通 struct 一样使用
    let origin = Point(0, 0)
    println("原点: (${origin.x}, ${origin.y})")
}