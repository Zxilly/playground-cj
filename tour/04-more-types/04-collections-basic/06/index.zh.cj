import std.collection.{ArrayList, HashMap, HashSet}

main(): Int64 {
    let rawIds = [101, 102, 102, 103]
    let idList = ArrayList<Int64>(rawIds)
    let uniqueIds = HashSet<Int64>(idList)

    println("list size = ${idList.size}")
    println("set size = ${uniqueIds.size}")

    let pairs = [("alice", 95), ("bob", 88)]
    let scores = HashMap<String, Int64>(pairs)
    for ((name, score) in scores) {
        println("${name} => ${score}")
    }
    return 0
}
