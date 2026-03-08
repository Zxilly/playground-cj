import std.collection.ArrayList

main(): Unit {
    // ArrayList is imported from std.collection
    let items = ArrayList<String>()
    items.append("Cangjie")
    items.append("Packages")
    items.append("Are Fun")

    for (item in items) {
        println(item)
    }
}
