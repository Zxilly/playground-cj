enum Direction {
    | North | South | East | West
}

main() {
    let dir = Direction.North

    // Exhaustively match all enum variants -- no _ branch needed
    let label = match (dir) {
        case North => "北"
        case South => "南"
        case East => "东"
        case West => "西"
    }
    println("方向: ${label}")

    // For types like Int64, use _ or a binding pattern to ensure exhaustiveness
    let x = 42
    match (x) {
        case 0 => println("零")
        case 1 => println("一")
        case other => println("其他值: ${other}")
    }
}
