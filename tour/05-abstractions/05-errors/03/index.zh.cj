func processFile(filename: String): Unit {
    println("打开文件：${filename}")
    try {
        if (filename.isEmpty()) {
            throw Exception("文件名不能为空")
        }
        println("处理文件内容...")
    } catch (e: Exception) {
        println("处理失败：${e.message}")
    } finally {
        // 无论成功或失败，都会执行
        println("关闭文件：${filename}")
    }
}

func riskyOperation(): Int64 {
    try {
        println("开始执行风险操作")
        throw Exception("操作失败")
        println("这行不会执行")
        return 1
    } catch (e: Exception) {
        println("捕获异常：${e.message}")
        return -1  // 即使这里返回，finally 也会先执行
    } finally {
        println("finally 块总是执行")
    }
}

main() {
    // 情况 1：正常执行
    println("=== 正常情况 ===")
    processFile("data.txt")

    println("")

    // 情况 2：抛出异常
    println("=== 异常情况 ===")
    processFile("")

    println("")

    // 情况 3：catch 中有 return
    println("=== 带返回值的情况 ===")
    let result = riskyOperation()
    println("返回值：${result}")
}