class Point {
    let x: Int64
    let y: Int64

    public init(x: Int64, y: Int64) {
        this.x = x
        this.y = y
    }

    public operator func -(): Point {
        return Point(-x, -y)
    }

    public operator func +(right: Point): Point {
        return Point(x + right.x, y + right.y)
    }
}

main(): Int64 {
    let left = Point(2, 3)
    let right = Point(10, 20)
    let sum = left + right
    let mirrored = -left

    println("sum = (${sum.x}, ${sum.y})")
    println("mirrored = (${mirrored.x}, ${mirrored.y})")
    return 0
}
