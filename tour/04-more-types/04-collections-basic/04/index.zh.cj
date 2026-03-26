import std.collection.{ArrayList, HashMap}

main(): Int64 {
    // 创建 ArrayList
    let stages = ArrayList<String>(["parse", "type-check", "optimize", "codegen"])
    
    // 方式 1: for-in 循环遍历
    println("=== 方式 1: for-in 循环 ===")
    for (stage in stages) {
        println("  ${stage}")
    }
    
    // 方式 2: 使用迭代器手动遍历
    println("\n=== 方式 2: 迭代器 + while 循环 ===")
    var iter = stages.iterator()
    while (let Some(stage) <- iter.next()) {
        println("  ${stage}")
    }
    
    // 方式 3: HashMap 的元组解构遍历
    println("\n=== 方式 3: HashMap 元组解构 ===")
    let scores = HashMap<String, Int64>([("alice", 95), ("bob", 88), ("carol", 92)])
    for ((name, score) in scores) {
        println("  ${name} => ${score}")
    }
    
    // 演示迭代器的 Option 返回值
    println("\n=== 迭代器返回值演示 ===")
    let list = ArrayList<Int64>([1, 2, 3])
    var it = list.iterator()
    match (it.next()) {
        case Some(v) => println("第一个元素：${v}")
        case None => println("列表为空")
    }
    
    return 0
}