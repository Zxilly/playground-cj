import std.collection.HashMap

// 查找分数：返回 Option，因为"未找到"是正常情况
func findScore(name: String): ?Int64 {
    let scores = HashMap<String, Int64>([
        ("alice", 95),
        ("bob", 88)
    ])
    
    if (scores.contains(name)) {
        return scores[name]  // 自动包装为 Some
    }
    None  // 用户不存在是正常情况
}

// 取款操作：抛出异常，因为余额不足是错误情况
func withdraw(balance: Int64, amount: Int64): Int64 {
    if (amount < 0) {
        throw Exception("取款金额不能为负数")
    }
    if (amount > balance) {
        throw Exception("余额不足：当前余额 ${balance}，需要 ${amount}")
    }
    return balance - amount
}

main() {
    // 使用 Option 处理查找结果
    println("=== 查找分数 ===")
    
    match (findScore("alice")) {
        case Some(score) => 
            println("alice 分数: ${score}")
        case None => 
            println("alice 无分数记录")
    }

    match (findScore("carol")) {
        case Some(score) => 
            println("carol 分数: ${score}")
        case None => 
            println("carol 无分数记录")
    }

    // 使用异常处理错误情况
    println("\n=== 取款操作 ===")

    // 正常取款
    try {
        let newBalance = withdraw(100, 30)
        println("取款成功，新余额: ${newBalance}")
    } catch (e: Exception) {
        println("取款失败: ${e.message}")
    }

    // 余额不足
    try {
        let newBalance = withdraw(100, 130)
        println("取款成功，新余额: ${newBalance}")
    } catch (e: Exception) {
        println("取款失败: ${e.message}")
    }

    // 非法金额
    try {
        let newBalance = withdraw(100, -10)
        println("取款成功，新余额: ${newBalance}")
    } catch (e: Exception) {
        println("取款失败: ${e.message}")
    }
}