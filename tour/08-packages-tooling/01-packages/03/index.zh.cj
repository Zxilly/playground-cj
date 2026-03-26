// 使用别名导入，避免名称冲突或简化类型名
import std.collection.ArrayList as List
import std.collection.HashMap as Map

main(): Unit {
    // 使用别名为 ArrayList 的名称 "List"
    let names = List<String>()
    names.append("张三")
    names.append("李四")
    names.append("王五")
    
    println("用户列表:")
    for (name in names) {
        println("  - ${name}")
    }
    
    // 使用别名为 HashMap 的名称 "Map"
    let scores = Map<String, Int64>()
    scores["张三"] = 95
    scores["李四"] = 87
    scores["王五"] = 92
    
    println("\n成绩统计:")
    for ((name, score) in scores) {
        println("  ${name}: ${score} 分")
    }
    
    // 计算平均分
    var total: Int64 = 0
    for ((_, score) in scores) {
        total += score
    }
    let avg = total / scores.size
    println("\n平均分: ${avg}")
}