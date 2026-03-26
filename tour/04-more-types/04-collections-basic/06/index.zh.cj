import std.collection.{ArrayList, HashMap, HashSet}

main(): Int64 {
    // 数组 -> ArrayList
    let rawIds = [101, 102, 102, 103, 103, 104]
    let idList = ArrayList<Int64>(rawIds)
    println("原始数组：${rawIds}")
    println("ArrayList 大小：${idList.size}")
    
    // ArrayList -> HashSet（去重）
    let uniqueIds = HashSet<Int64>(idList)
    println("HashSet 大小（去重后）：${uniqueIds.size}")
    print("唯一 ID：")
    for (id in uniqueIds) {
        print(" ${id}")
    }
    println()
    
    // 元组数组 -> HashMap
    let pairs = [("alice", 95), ("bob", 88), ("carol", 92)]
    let scores = HashMap<String, Int64>(pairs)
    println("\nHashMap 大小：${scores.size}")
    println("学生分数表：")
    for ((name, score) in scores) {
        println("  ${name} => ${score}")
    }
    
    // HashSet -> ArrayList（有序化）
    let sortedIds = ArrayList<Int64>(uniqueIds)
    println("\nHashSet -> ArrayList：")
    println("  大小 = ${sortedIds.size}")
    
    // HashMap -> ArrayList（提取键或值）
    let names = ArrayList<String>()
    for ((name, _) in scores) {
        names.add(name)
    }
    println("提取所有键：")
    for (name in names) {
        print(" ${name}")
    }
    println()
    
    return 0
}