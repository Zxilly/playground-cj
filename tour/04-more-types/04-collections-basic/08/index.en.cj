import std.collection.HashMap

main(): Int64 {
    let tags = ["ui", "db", "ui", "net", "db", "ui"]
    let counts = HashMap<String, Int64>()

    for (tag in tags) {
        if (counts.contains(tag)) {
            counts[tag] = counts[tag] + 1
        } else {
            counts.add(tag, 1)
        }
    }

    for ((tag, count) in counts) {
        println("${tag} => ${count}")
    }
    return 0
}
