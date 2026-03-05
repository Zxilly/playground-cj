interface HasArea {
    func area(): Float64
}

interface HasPerimeter {
    func perimeter(): Float64
}

class Circle <: HasArea & HasPerimeter {
    let radius: Float64

    init(r: Float64) {
        this.radius = r
    }

    func area(): Float64 {
        3.14159 * radius * radius
    }

    func perimeter(): Float64 {
        2.0 * 3.14159 * radius
    }
}

struct Square <: HasArea & HasPerimeter {
    let side: Float64

    init(s: Float64) {
        this.side = s
    }

    func area(): Float64 {
        side * side
    }

    func perimeter(): Float64 {
        4.0 * side
    }
}

main() {
    let c = Circle(5.0)
    println("Circle: area=${c.area()}, perimeter=${c.perimeter()}")

    let s = Square(4.0)
    println("Square: area=${s.area()}, perimeter=${s.perimeter()}")
}