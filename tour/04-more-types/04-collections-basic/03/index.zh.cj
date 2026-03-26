import std.collection.HashMap

main(): Int64 {
    // 创建空的 HashMap
    let scores = HashMap<String, Int64>()
    
    // 添加键值对
    scores.add("alice", 95)
    scores.add("bob", 88)
    scores.add("carol", 92)
    println("添加 3 个学生后：size = ${scores.size}")
    
    // 使用下标赋值添加键值对
    scores["david"] = 78
    println("添加 david 后：size = ${scores.size}")
    
    // 检查键是否存在并读取值
    if (scores.contains("alice")) {
        println("alice 的分数：${scores["alice"]}")
    }
    
    // 修改已有键的值
    scores["bob"] = 90
    println("bob 更新后的分数：${scores["bob"]}")
    
    // 删除键值对
    scores.remove("carol")
    println("删除 carol 后：size = ${scores.size}")
    
    // 遍历所有键值对
    println("所有学生分数：")
    for ((name, score) in scores) {
        println("  ${name} => ${score}")
    }
    
    return 0
}