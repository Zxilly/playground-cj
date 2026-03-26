// Define drawing interface
interface Drawable {
    func draw(): String
    func area(): Float64
}

// Line
class Line <: Drawable {
    let length: Float64

    init(length: Float64) {
        this.length = length
    }

    public func draw(): String {
        "Draw a line"
    }

    public func area(): Float64 {
        0.0  // Lines have no area
    }
}

// Circle
class Circle <: Drawable {
    let radius: Float64

    init(radius: Float64) {
        this.radius = radius
    }

    public func draw(): String {
        "Draw a circle with radius ${radius}"
    }

    public func area(): Float64 {
        3.14159 * radius * radius
    }
}

// Rectangle
class Rectangle <: Drawable {
    let width: Float64
    let height: Float64

    init(w: Float64, h: Float64) {
        this.width = w
        this.height = h
    }

    public func draw(): String {
        "Draw a ${width}x${height} rectangle"
    }

    public func area(): Float64 {
        width * height
    }
}

main() {
    // Interface array can store objects of different types
    let drawings: Array<Drawable> = [
        Line(5.0),
        Circle(3.0),
        Rectangle(4.0, 5.0)
    ]

    println("=== Drawing System ===")
    var totalArea: Float64 = 0.0

    for (item in drawings) {
        println("Operation: ${item.draw()}")
        let a = item.area()
        println("Area: ${a}")
        totalArea += a
        println()
    }

    println("Total Area: ${totalArea}")

    // Interface variable can be reassigned to different implementation types
    var shape: Drawable = Circle(2.0)
    println("\nCurrent shape: ${shape.draw()}")
    
    shape = Rectangle(3.0, 4.0)
    println("After switch: ${shape.draw()}")
}