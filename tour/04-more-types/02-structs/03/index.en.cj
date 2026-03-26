struct Circle {
    let radius: Float64

    init(radius: Float64) {
        this.radius = radius
    }

    // Calculate area
    func area(): Float64 {
        3.14159 * radius * radius
    }

    // Calculate circumference
    func circumference(): Float64 {
        2.0 * 3.14159 * radius
    }

    // Return description string
    func describe(): String {
        "Circle(r=${radius})"
    }

    // Compare two circles by size
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

    let larger = if (c1.isLargerThan(c2)) { "c1" } else { "c2" }
    println("Larger circle: ${larger}")
}