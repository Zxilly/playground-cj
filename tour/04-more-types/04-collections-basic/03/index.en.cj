import std.collection.HashMap

main(): Int64 {
    // Create an empty HashMap
    let scores = HashMap<String, Int64>()
    
    // Add key-value pairs
    scores.add("alice", 95)
    scores.add("bob", 88)
    scores.add("carol", 92)
    println("After adding 3 students: size = ${scores.size}")
    
    // Add key-value pair using subscript assignment
    scores["david"] = 78
    println("After adding david: size = ${scores.size}")
    
    // Check if key exists and read the value
    if (scores.contains("alice")) {
        println("alice's score: ${scores["alice"]}")
    }
    
    // Modify the value of an existing key
    scores["bob"] = 90
    println("bob's updated score: ${scores["bob"]}")
    
    // Delete a key-value pair
    scores.remove("carol")
    println("After deleting carol: size = ${scores.size}")
    
    // Iterate through all key-value pairs
    println("All student scores:")
    for ((name, score) in scores) {
        println("  ${name} => ${score}")
    }
    
    return 0
}