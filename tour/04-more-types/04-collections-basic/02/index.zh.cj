import std.collection.HashSet

main(): Int64 {
    let tags = HashSet<String>()
    tags.add("tour")
    tags.add("collections")
    tags.add("tour")

    println("contains 'tour' = ${tags.contains("tour")}")
    println("size = ${tags.size}")

    tags.remove("collections")

    for (tag in tags) {
        println(tag)
    }
    return 0
}
