// 使用异常：除零是程序错误，应该被修复
func divideException(a: Float64, b: Float64): Float64 {
    if (b == 0.0) {
        throw IllegalArgumentException("除数不能为零")
    }
    a / b
}

// 使用 Option：除零是正常可能，需要处理
func divideOption(a: Float64, b: Float64): Option<Float64> {
    if (b == 0.0) {
        None
    } else {
        Some(a / b)
    }
}

// 模拟查找操作：不存在是正常结果
func findUser(id: Int64): Option<String> {
    if (id == 1) {
        Some("Alice")
    } else if (id == 2) {
        Some("Bob")
    } else {
        None  // 用户不存在是正常情况
    }
}

main() {
    // 异常风格：期望调用者传入合法参数
    try {
        let result = divideException(10.0, 2.0)
        println("10.0 / 2.0 = ${result}")
    } catch (e: IllegalArgumentException) {
        println("错误：${e.message}")
    }

    // Option 风格：调用者必须处理 None
    let r1 = divideOption(10.0, 4.0)
    let r2 = divideOption(10.0, 0.0)

    match (r1) {
        case Some(v) => println("10.0 / 4.0 = ${v}")
        case None => println("除零错误")
    }

    match (r2) {
        case Some(v) => println("10.0 / 0.0 = ${v}")
        case None => println("除零错误")
    }

    // 使用 ?? 提供默认值
    let safe1 = divideOption(10.0, 2.0) ?? 0.0
    let safe2 = divideOption(10.0, 0.0) ?? 0.0
    println("使用默认值：${safe1}, ${safe2}")

    // 查找操作：不存在是正常的
    match (findUser(1)) {
        case Some(name) => println("找到用户：${name}")
        case None => println("用户不存在")
    }

    match (findUser(99)) {
        case Some(name) => println("找到用户：${name}")
        case None => println("用户不存在")
    }
}