enum Direction {
    | North | South | East | West
}

main() {
    let dir = Direction.North

    // enum must exhaust all constructors — no need for _ branch
    let label = match (dir) {
        case North => "North"
        case South => "South"
        case East => "East"
        case West => "West"
    }
    println("Direction: ${label}")

    // For open types like Int64, must use _ or binding pattern
    let x = 42
    match (x) {
        case 0 => println("Zero")
        case 1 => println("One")
        case n => println("Other value: ${n}")  // Binding pattern covers remaining cases
    }

    // Binding patterns also ensure exhaustiveness
    let code = 404
    let description = match (code) {
        case 200 => "Success"
        case 404 => "Not found"
        case 500 => "Server error"
        case other => "Status code: ${other}"  // Handle all other values
    }
    println(description)
}