import std.collection.HashSet

main(): Int64 {
    // Create an empty HashSet
    let tags = HashSet<String>()
    
    // Add elements
    tags.add("tour")
    tags.add("collections")
    tags.add("rust")
    println("After adding 3 elements: size = ${tags.size}")
    
    // Try to add duplicate elements
    tags.add("tour")  // Already exists, won't be added
    tags.add("ROST")  // Different element (case-sensitive)
    println("After adding duplicate 'tour': size = ${tags.size}")
    
    // Check if elements exist
    println("contains 'tour' = ${tags.contains("tour")}")
    println("contains 'Rust' = ${tags.contains("Rust")}")
    
    // Delete an element
    tags.remove("collections")
    println("After deleting 'collections': size = ${tags.size}")
    
    // Iterate through all elements (order may not be fixed)
    println("All tags:")
    for (tag in tags) {
        println("  ${tag}")
    }
    
    return 0
}