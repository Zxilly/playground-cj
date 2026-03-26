import std.collection.HashMap

main(): Int64 {
    let tags = ["ui", "db", "ui", "net", "db", "ui", "cache", "net", "ui", "db"]
    let counts = HashMap<String, Int64>()
    
    println("Tag array:")
    for (tag in tags) {
        print("${tag} ")
    }
    println("\n")
    
    // Count the occurrence of each tag
    for (tag in tags) {
        if (counts.contains(tag)) {
            // Key exists, retrieve current count and increment
            counts[tag] = counts[tag] + 1
        } else {
            // Key doesn't exist, insert initial value 1
            counts.add(tag, 1)
        }
    }
    
    // Output the statistics
    println("Tag occurrence counts:")
    for ((tag, count) in counts) {
        println("  ${tag} => ${count}")
    }
    
    // Calculate total tag count
    var totalTags = 0
    for (tag in tags) {
        totalTags += 1
    }
    println("\nTotal tags: ${totalTags}")
    
    // Calculate unique tag count
    println("Unique tag count: ${counts.size}")
    
    return 0
}