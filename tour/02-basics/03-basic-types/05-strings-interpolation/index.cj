main() {
    let name = "仓颉"
    let version = 1

    // 字符串插值
    println("欢迎使用 ${name} 语言！")
    println("版本号: ${version}")

    // 插值中使用表达式
    let a = 10
    let b = 20
    println("${a} + ${b} = ${a + b}")

    // 转义字符
    println("第一行\n第二行")
    println("制表符:\t对齐")

    // 多行字符串
    let text = """
    这是一个
    多行字符串
    示例
    """
    println(text)
}
