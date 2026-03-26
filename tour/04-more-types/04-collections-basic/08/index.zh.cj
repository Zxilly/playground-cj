import std.collection.HashMap

main(): Int64 {
    let tags = ["ui", "db", "ui", "net", "db", "ui", "cache", "net", "ui", "db"]
    let counts = HashMap<String, Int64>()
    
    println("标签数组：")
    for (tag in tags) {
        print("${tag} ")
    }
    println("\n")
    
    // 统计每个标签的出现次数
    for (tag in tags) {
        if (counts.contains(tag)) {
            // 键存在，取出当前计数并加一
            counts[tag] = counts[tag] + 1
        } else {
            // 键不存在，插入初始值 1
            counts.add(tag, 1)
        }
    }
    
    // 输出统计结果
    println("标签出现次数：")
    for ((tag, count) in counts) {
        println("  ${tag} => ${count}")
    }
    
    // 计算总标签数
    var totalTags = 0
    for (tag in tags) {
        totalTags += 1
    }
    println("\n总标签数：${totalTags}")
    
    // 计算不同标签数
    println("不同标签数：${counts.size}")
    
    return 0
}