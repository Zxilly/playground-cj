enum Direction {
    | North
    | South
    | East
    | West
}

func describe(dir: Direction): String {
    match (dir) {
        case North => "Going north"
        case South => "Going south"
        case East => "Going east"
        case West => "Going west"
    }
}

main() {
    let dir = Direction.North
    println(describe(dir))
    println(describe(Direction.East))

    // Enums in conditions
    let heading = Direction.West
    let isVertical = match (heading) {
        case North | South => true
        case East | West => false
    }
    println("West is vertical? ${isVertical}")
}