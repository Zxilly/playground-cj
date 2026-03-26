func requireAdult(age: Int64): Int64 {
    if (age < 18) {
        throw Exception("年龄必须至少 18 岁")
    }
    age
}

func divide(a: Int64, b: Int64): Int64 {
    if (b == 0) {
        throw ArithmeticException("除数不能为零")
    }
    a / b
}

main() {
    // 处理验证异常
    try {
        let age = requireAdult(16)
        println("成年年龄：${age}")
    } catch (e: Exception) {
        println("验证失败：${e.message}")
    }

    // 处理算术异常
    try {
        println("20 / 4 = ${divide(20, 4)}")
        println("20 / 0 = ${divide(20, 0)}")
    } catch (e: ArithmeticException) {
        println("计算错误：${e.message}")
    }

    // 第一个异常被捕获后，程序继续执行
    try {
        let age = requireAdult(25)
        println("验证通过，年龄：${age}")
    } catch (e: Exception) {
        println("验证失败：${e.message}")
    }

    println("程序正常结束")
}