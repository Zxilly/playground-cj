import std.collection.*

main() {
    // Array to ArrayList
    let arr = [1, 2, 3, 4, 5]
    let list = ArrayList<Int64>(arr)
    println("Array to ArrayList: ${list}")

    // ArrayList to HashSet (deduplication)
    let withDups = ArrayList<Int64>([1, 2, 2, 3, 3, 3, 4])
    let unique = HashSet<Int64>()
    for (n in withDups) {
        unique.put(n)
    }
    println("With duplicates: ${withDups}")
    println("Deduplicated set: ${unique}")

    // HashSet back to ArrayList
    let uniqueList = ArrayList<Int64>()
    for (n in unique) {
        uniqueList.append(n)
    }
    println("Back to list: ${uniqueList}")

    // Build HashMap from two lists
    let keys = ["name", "age", "city"]
    let values = ["Alice", "30", "Beijing"]
    let map = HashMap<String, String>()
    for (i in 0..keys.size) {
        map.put(keys[i], values[i])
    }
    println("Built map: ${map}")

    // Extract keys and values from HashMap
    let allKeys = ArrayList<String>()
    let allValues = ArrayList<String>()
    for ((k, v) in map) {
        allKeys.append(k)
        allValues.append(v)
    }
    println("Keys: ${allKeys}")
    println("Values: ${allValues}")
}