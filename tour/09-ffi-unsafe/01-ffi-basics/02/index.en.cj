// @C modifies struct to make its memory layout C-compatible
@C
struct Point {
    var x: Int64 = 0
    var y: Int64 = 0
    
    init(x: Int64, y: Int64) {
        this.x = x
        this.y = y
    }
}

// @C modifies function to make it callable by C code
// Calling @C functions also requires unsafe context
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
    
    // @C functions must be called in unsafe blocks
    let sum = unsafe { addPoints(p1, p2) }
    println("Sum of points: (${sum.x}, ${sum.y})")
    
    let dist1 = unsafe { distanceSquared(p1) }
    println("Squared distance from p1 to origin: ${dist1}")
    
    let dist2 = unsafe { distanceSquared(p2) }
    println("Squared distance from p2 to origin: ${dist2}")
    
    // @C struct can be used like normal struct
    let origin = Point(0, 0)
    println("Origin: (${origin.x}, ${origin.y})")
}