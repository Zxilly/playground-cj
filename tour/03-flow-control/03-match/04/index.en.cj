main() {
    let point = (1, 0)

    // Tuple pattern: match and destructure coordinates
    match (point) {
        case (0, 0) => println("This is the origin")
        case (x, 0) => println("On x-axis, x = ${x}")
        case (0, y) => println("On y-axis, y = ${y}")
        case (x, y) => println("Coordinate point (${x}, ${y})")
    }

    // Combining value patterns and binding patterns
    let record = ("Alice", 95)
    match (record) {
        case (name, 100) => println("${name} got a perfect score!")
        case (name, score) => println("${name}'s score: ${score}")
    }

    // Triple tuple matching
    let rgb = (255, 128, 0)
    match (rgb) {
        case (255, 255, 255) => println("White")
        case (0, 0, 0) => println("Black")
        case (r, g, b) => println("RGB(${r}, ${g}, ${b})")
    }
}