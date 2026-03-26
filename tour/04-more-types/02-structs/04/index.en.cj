struct Point {
    var x: Float64
    var y: Float64

    init(x: Float64, y: Float64) {
        this.x = x
        this.y = y
    }

    // Regular method: can only read fields
    func display(): String {
        "(${x}, ${y})"
    }

    // mut method: can modify fields
    mut func translate(dx: Float64, dy: Float64) {
        x += dx
        y += dy
    }

    mut func scale(factor: Float64) {
        x *= factor
        y *= factor
    }

    mut func reset() {
        x = 0.0
        y = 0.0
    }
}

main() {
    // Must use var declaration to call mut methods
    var p = Point(1.0, 2.0)
    println("Initial: ${p.display()}")

    p.translate(3.0, 4.0)
    println("After translation: ${p.display()}")

    p.scale(2.0)
    println("After scaling: ${p.display()}")

    p.reset()
    println("After reset: ${p.display()}")
}