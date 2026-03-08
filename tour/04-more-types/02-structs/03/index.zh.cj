struct Circle {
    let radius: Float64

    init(radius: Float64) {
        this.radius = radius
    }

    func area(): Float64 {
        3.14159 * radius * radius
    }

    func circumference(): Float64 {
        2.0 * 3.14159 * radius
    }

    func describe(): String {
        "Circle(r=${radius})"
    }

    func isLargerThan(other: Circle): Bool {
        this.area() > other.area()
    }
}

main() {
    let c1 = Circle(5.0)
    let c2 = Circle(3.0)

    println(c1.describe())
    println("Area: ${c1.area()}")
    println("Circumference: ${c1.circumference()}")

    println("${c1.describe()} larger than ${c2.describe()}? ${c1.isLargerThan(c2)}")
}