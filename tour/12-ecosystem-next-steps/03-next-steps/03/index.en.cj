// Example of exploring Cangjie resources

import std.collection.ArrayList
import std.random.Random

main() {
    println("=== Cangjie Learning Resources ===\n")
    
    // Official resources
    println("Official documentation: https://cangjie-lang.cn/docs")
    println("Standard library source: https://gitcode.com/Cangjie/cangjie-stdlib")
    println("Community package index: https://gitcode.com/Cangjie-TPC")
    println("Official forum: https://cangjie-lang.cn/community\n")
    
    // Show more topics to learn
    let topics = ArrayList<String>()
    topics.add("Network programming (std.net.*)")
    topics.add("File system (std.fs.*)")
    topics.add("Database access")
    topics.add("JSON/XML processing")
    topics.add("Reflection and annotations")
    topics.add("FFI interoperability")
    topics.add("Advanced concurrency patterns")
    
    println("Advanced learning directions:")
    for ((topic, i) in topics) {
        println("  ${i + 1}. ${topic}")
    }
    
    println("\nHappy learning and smooth coding!")
    
    // Easter egg: a simple random selector using what we've learned
    println("\nRandom recommendation: ${topics[Random().nextUInt64() % topics.size.toUInt64()].value}")
}