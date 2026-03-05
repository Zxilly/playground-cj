import std.collection.*

main() {
    // Create a HashMap
    let scores = HashMap<String, Int64>()
    scores.put("Alice", 95)
    scores.put("Bob", 82)
    scores.put("Carol", 91)
    println("Scores: ${scores}")

    // Access by key
    println("Alice: ${scores["Alice"]}")
    println("Bob: ${scores["Bob"]}")

    // Check if key exists
    println("Has 'Alice': ${scores.contains("Alice")}")
    println("Has 'Dave': ${scores.contains("Dave")}")

    // Update value
    scores.put("Bob", 88)
    println("Bob updated: ${scores["Bob"]}")

    // Remove entry
    scores.remove("Carol")
    println("After removing Carol: ${scores}")

    // Iterate over entries
    println("All scores:")
    for ((name, score) in scores) {
        println("  ${name}: ${score}")
    }

    println("Size: ${scores.size}")
}