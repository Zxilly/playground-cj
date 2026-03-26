// 泛型枚举：表示可能成功或失败的结果
enum Result<T, E> {
    | Ok(T)        // 成功，携带类型为 T 的值
    | Err(E)       // 失败，携带类型为 E 的错误
}

// 使用泛型枚举处理除法
func safeDivide(a: Int64, b: Int64): Result<Int64, String> {
    if (b == 0) {
        return Err("除数不能为零")
    }
    return Ok(a / b)
}

// 处理 Result 的函数
func processResult(result: Result<Int64, String>) {
    match (result) {
        case Ok(value) =>
            println("成功: 结果是 ${value}")
        case Err(message) =>
            println("错误: ${message}")
    }
}

// 使用泛型枚举表示可能存在或不存在的值
func findValue(key: String, data: Map<String, Int64>): Result<Int64, String> {
    if (data.contains(key)) {
        return Ok(data[key])
    }
    return Err("找不到键: ${key}")
}

main() {
    // 测试安全除法
    let r1 = safeDivide(10, 3)
    processResult(r1)

    let r2 = safeDivide(10, 0)
    processResult(r2)

    println("---")

    // 测试查找值
    let scores = Map<String, Int64>([
        ("张三", 85),
        ("李四", 92),
        ("王五", 78)
    ])

    let r3 = findValue("张三", scores)
    processResult(r3)

    let r4 = findValue("赵六", scores)
    processResult(r4)
}