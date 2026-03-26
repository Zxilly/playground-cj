// Use aliased imports to avoid name conflicts or simplify type names
import std.collection.ArrayList as List
import std.collection.HashMap as Map

main(): Unit {
    // Use the aliased name "List" for ArrayList
    let names = List<String>()
    names.append("Alice")
    names.append("Bob")
    names.append("Charlie")
    
    println("User list:")
    for (name in names) {
        println("  - ${name}")
    }
    
    // Use the aliased name "Map" for HashMap
    let scores = Map<String, Int64>()
    scores["Alice"] = 95
    scores["Bob"] = 87
    scores["Charlie"] = 92
    
    println("\nScore statistics:")
    for ((name, score) in scores) {
        println("  ${name}: ${score} points")
    }
    
    // Calculate average score
    var total: Int64 = 0
    for ((_, score) in scores) {
        total += score
    }
    let avg = total / scores.size
    println("\nAverage score: ${avg}")
}