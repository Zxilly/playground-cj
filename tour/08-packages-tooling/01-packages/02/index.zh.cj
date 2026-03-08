import std.collection.ArrayList

main(): Unit {
    // ArrayList 从 std.collection 导入
    let items = ArrayList<String>()
    items.append("Cangjie")
    items.append("Packages")
    items.append("Are Fun")

    for (item in items) {
        println(item)
    }
}
