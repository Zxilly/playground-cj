import std.collection.{ArrayList, HashMap, HashSet}

main(): Int64 {
    // Array -> ArrayList
    let rawIds = [101, 102, 102, 103, 103, 104]
    let idList = ArrayList<Int64>(rawIds)
    println("Original array: ${rawIds}")
    println("ArrayList size: ${idList.size}")
    
    // ArrayList -> HashSet (deduplication)
    let uniqueIds = HashSet<Int64>(idList)
    println("HashSet size (after deduplication): ${uniqueIds.size}")
    print("Unique IDs:")
    for (id in uniqueIds) {
        print(" ${id}")
    }
    println()
    
    // Tuple array -> HashMap
    let pairs = [("alice", 95), ("bob", 88), ("carol", 92)]
    let scores = HashMap<String, Int64>(pairs)
    println("\nHashMap size: ${scores.size}")
    println("Student score table:")
    for ((name, score) in scores) {
        println("  ${name} => ${score}")
    }
    
    // HashSet -> ArrayList (ordering)
    let sortedIds = ArrayList<Int64>(uniqueIds)
    println("\nHashSet -> ArrayList:")
    println("  size = ${sortedIds.size}")
    
    // HashMap -> ArrayList (extract keys or values)
    let names = ArrayList<String>()
    for ((name, _) in scores) {
        names.add(name)
    }
    println("Extract all keys:")
    for (name in names) {
        print(" ${name}")
    }
    println()
    
    return 0
}