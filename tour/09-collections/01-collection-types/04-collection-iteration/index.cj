import std.collection.*

main() {
    // Iterate over ArrayList
    let fruits = ArrayList<String>(["apple", "banana", "cherry", "date"])
    println("=== ArrayList ===")
    for (fruit in fruits) {
        println("  ${fruit}")
    }

    // Indexed iteration
    println("With index:")
    for (i in 0..fruits.size) {
        println("  [${i}] ${fruits[i]}")
    }

    // Iterate over HashSet
    println("\n=== HashSet ===")
    let tags = HashSet<String>()
    tags.put("rust")
    tags.put("cangjie")
    tags.put("python")
    for (tag in tags) {
        println("  #${tag}")
    }

    // Iterate over HashMap
    println("\n=== HashMap ===")
    let capitals = HashMap<String, String>()
    capitals.put("China", "Beijing")
    capitals.put("Japan", "Tokyo")
    capitals.put("France", "Paris")
    for ((country, city) in capitals) {
        println("  ${country} -> ${city}")
    }

    // Iterate over keys only
    println("Keys:")
    for ((key, _) in capitals) {
        println("  ${key}")
    }
}