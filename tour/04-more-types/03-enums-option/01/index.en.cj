// Define an enum type representing directions
enum Direction {
    | North
    | South
    | East
    | West
}

// Use match expression to handle all enum cases
func describe(dir: Direction): String {
    match (dir) {
        case North => "Go north"
        case South => "Go south"
        case East => "Go east"
        case West => "Go west"
    }
}

main() {
    // Create enum values via TypeName.Constructor
    let dir1 = Direction.North
    let dir2 = Direction.West
    
    // Use constructor name directly (when no naming conflict)
    let dir3 = South
    
    println("Direction 1: ${describe(dir1)}")
    println("Direction 2: ${describe(dir2)}")
    println("Direction 3: ${describe(dir3)}")
}