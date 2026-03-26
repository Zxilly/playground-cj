main() {
    let name = "仓颉"
    let version = 1
    let lessons = 3

    // 基本插值
    println("欢迎使用 ${name} 语言！")
    println("版本号: ${version}")
    println("今天准备完成 ${lessons} 节课。")

    // 插值中使用表达式
    println("下一节课编号是 ${lessons + 1}。")
    println("完成 ${lessons} 节课约需 ${lessons * 30} 分钟。")

    // 插值中使用复杂表达式
    let price = 99.9
    let quantity = 3
    println("总价: ${price * Float64(quantity)}")

    // 插值中使用声明
    let area = "半径为 2 的圆面积: ${let r = 2.0; let PI = 3.141592; PI * r * r}"
    println(area)

    // 多行字符串
    let multiline = """
        第一行
        第二行
        第三行
        """
    print(multiline)

    // 多行原始字符串（转义字符不被解释）
    let raw = ###"原始字符串中的 \n 不是换行符"###
    println("原始字符串: ${raw}")

    // 字符串拼接
    let greeting = "你好, " + name + "!"
    println(greeting)

    // 字符串比较
    let s1 = "abc"
    let s2 = "ABC"
    println("'${s1}' == '${s2}': ${s1 == s2}")
}