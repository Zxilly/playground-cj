main() {
    // 单行字符串（双引号）
    let name = "仓颉"
    println("欢迎使用 ${name} 语言！")

    // 单行字符串（单引号）
    let greeting = 'Hello World'
    println("问候: ${greeting}")

    // 字符串拼接
    let firstName = "张"
    let lastName = "三"
    let fullName = firstName + lastName
    println("完整姓名: ${fullName}")

    // 多行字符串
    let multiline = """
        这是一个
        多行字符串
        的示例
    """
    println(multiline)

    // 插值字符串
    let version = 1
    let lessons = 3
    let remaining = lessons - 1
    println("版本号: ${version}")
    println("今天准备完成 ${lessons} 节课")
    println("已完成 1 节，还剩 ${remaining} 节")

    // 插值中包含复杂表达式
    let a = 10
    let b = 20
    println("${a} + ${b} = ${a + b}")

    // 插值中包含声明
    let info = "圆周率约为 ${let pi = 3.14159; pi}"
    println(info)

    // 字符串比较
    let s1 = "hello"
    let s2 = "HELLO"
    println("'${s1}' == '${s2}': ${s1 == s2}")
    println("'${s1}' != '${s2}': ${s1 != s2}")

    // 字符串操作
    let text = "Hello, Cangjie!"
    println("包含 'Cangjie': ${text.contains("Cangjie")}")
}