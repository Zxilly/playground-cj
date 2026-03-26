import std.collection.HashSet

main(): Int64 {
    // 创建空的 HashSet
    let tags = HashSet<String>()
    
    // 添加元素
    tags.add("tour")
    tags.add("collections")
    tags.add("rust")
    println("添加 3 个元素后：size = ${tags.size}")
    
    // 尝试添加重复元素
    tags.add("tour")  // 已存在，不会添加
    tags.add("ROST")  // 不同元素（大小写不同）
    println("添加重复元素 'tour' 后：size = ${tags.size}")
    
    // 检查元素是否存在
    println("contains 'tour' = ${tags.contains("tour")}")
    println("contains 'Rust' = ${tags.contains("Rust")}")
    
    // 删除元素
    tags.remove("collections")
    println("删除 'collections' 后：size = ${tags.size}")
    
    // 遍历所有元素（顺序可能不固定）
    println("所有标签：")
    for (tag in tags) {
        println("  ${tag}")
    }
    
    return 0
}