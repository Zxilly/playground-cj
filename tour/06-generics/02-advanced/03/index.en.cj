import std.collection.*

// Define short aliases for complex generic types
type NameList = ArrayList<String>

// Alias for map type
type ScoreMap = HashMap<String, Int64>

// Can also define complex type aliases across projects
type Configuration = HashMap<String, String>

// Generic type alias (generic parameters need to be preserved when defining)
type RecordList<T> = ArrayList<T>

main() {
    // Use alias to create instance, more readable
    let names = NameList()
    names.add("Zhang San")
    names.add("Li Si")
    names.add("Wang Wu")

    println("Student List (${names.size} people):")
    for (name in names) {
        println("  - ${name}")
    }

    // Use alias to create score map
    let scores = ScoreMap()
    scores.add("Zhang San", 95)
    scores.add("Li Si", 87)
    scores.add("Wang Wu", 92)

    println("\nReport Card:")
    println("  Zhang San: ${scores["Zhang San"]} points")
    println("  Li Si: ${scores["Li Si"]} points")
    println("  Wang Wu: ${scores["Wang Wu"]} points")

    // Use generic alias
    let records = RecordList<Int64>()
    records.add(100)
    records.add(200)
    println("\nRecord count: ${records.size}")
}