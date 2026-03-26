import std.collection.{ArrayList, HashMap}

main(): Int64 {
    // Create an ArrayList
    let stages = ArrayList<String>(["parse", "type-check", "optimize", "codegen"])
    
    // Method 1: for-in loop iteration
    println("=== Method 1: for-in loop ===")
    for (stage in stages) {
        println("  ${stage}")
    }
    
    // Method 2: Manual iteration using iterator
    println("\n=== Method 2: Iterator + while loop ===")
    var iter = stages.iterator()
    while (let Some(stage) <- iter.next()) {
        println("  ${stage}")
    }
    
    // Method 3: HashMap tuple destructuring iteration
    println("\n=== Method 3: HashMap tuple destructuring ===")
    let scores = HashMap<String, Int64>([("alice", 95), ("bob", 88), ("carol", 92)])
    for ((name, score) in scores) {
        println("  ${name} => ${score}")
    }
    
    // Demonstrate iterator's Option return value
    println("\n=== Iterator return value demo ===")
    let list = ArrayList<Int64>([1, 2, 3])
    var it = list.iterator()
    match (it.next()) {
        case Some(v) => println("First element: ${v}")
        case None => println("List is empty")
    }
    
    return 0
}