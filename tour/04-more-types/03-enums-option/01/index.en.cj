enum Direction {
    | North
    | South
    | East
    | West
}

func describe(dir: Direction): String {
    match (dir) {
        case North => "向北走"
        case South => "向南走"
        case East => "向东走"
        case West => "向西走"
    }
}

main() {
    println(describe(Direction.North))
    println(describe(Direction.West))
}
