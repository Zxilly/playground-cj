enum Shape {
    | Circle(Float64)
    | Rectangle(Float64, Float64)
    | Triangle(Float64, Float64)
}

func area(s: Shape): Float64 {
    match (s) {
        case Circle(r) => 3.14159 * r * r
        case Rectangle(w, h) => w * h
        case Triangle(b, h) => 0.5 * b * h
    }
}

func describe(s: Shape): String {
    match (s) {
        case Circle(r) => "Circle with radius ${r}"
        case Rectangle(w, h) => "Rectangle ${w} x ${h}"
        case Triangle(b, h) => "Triangle base=${b}, height=${h}"
    }
}

main() {
    let shapes = [
        Shape.Circle(5.0),
        Shape.Rectangle(4.0, 6.0),
        Shape.Triangle(3.0, 8.0)
    ]

    for (s in shapes) {
        println("${describe(s)}, area = ${area(s)}")
    }
}
