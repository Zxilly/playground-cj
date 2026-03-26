// Define enum with data: different shapes carry different parameters
enum Shape {
    | Circle(Float64)              // Circle: radius
    | Rectangle(Float64, Float64)  // Rectangle: width and height
    | Triangle(Float64, Float64)   // Triangle: base and height
}

// Calculate the area of a shape
func area(s: Shape): Float64 {
    match (s) {
        case Circle(r) => 
            3.14159 * r * r
        case Rectangle(w, h) => 
            w * h
        case Triangle(b, h) => 
            0.5 * b * h
    }
}

// Generate a description string for a shape
func describe(s: Shape): String {
    match (s) {
        case Circle(r) => 
            "Circle(radius=${r})"
        case Rectangle(w, h) => 
            "Rectangle(${w} x ${h})"
        case Triangle(b, h) => 
            "Triangle(base=${b}, height=${h})"
    }
}

main() {
    // Create instances of different shapes
    let shapes = [
        Shape.Circle(5.0),
        Shape.Rectangle(4.0, 6.0),
        Shape.Triangle(3.0, 8.0)
    ]

    // Iterate and output information for each shape
    for (s in shapes) {
        let desc = describe(s)
        let a = area(s)
        println("${desc}, area = ${a}")
    }
}