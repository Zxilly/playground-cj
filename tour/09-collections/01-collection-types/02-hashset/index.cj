import std.collection.*

main() {
    // Create a HashSet
    let colors = HashSet<String>()
    colors.put("red")
    colors.put("green")
    colors.put("blue")
    println("Colors: ${colors}")
    println("Size: ${colors.size}")

    // Duplicates are ignored
    colors.put("red")
    println("After adding 'red' again: ${colors}")
    println("Size still: ${colors.size}")

    // Check membership
    println("Contains 'green': ${colors.contains("green")}")
    println("Contains 'yellow': ${colors.contains("yellow")}")

    // Remove element
    colors.remove("green")
    println("After removing 'green': ${colors}")

    // Set from array - deduplication
    let numbers = HashSet<Int64>()
    let arr = [1, 2, 3, 2, 1, 4, 3, 5]
    for (n in arr) {
        numbers.put(n)
    }
    println("Unique numbers: ${numbers}")
    println("Original had ${arr.size} items, unique: ${numbers.size}")
}