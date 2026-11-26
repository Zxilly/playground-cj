// 定义带默认值的命名参数
func greet(name!: String, greeting!: String = "你好") {
    println("${greeting}，${name}！")
}

// 多个参数都有默认值
func connect(host!: String, port!: Int64 = 8080, secure!: Bool = false) {
    let protocol = if (secure) { "https" } else { "http" }
    println("连接到 ${protocol}://${host}:${port}")
}

// 默认值可以是计算表达式
func repeat(str!: String, times!: Int64 = 3) {
    var result = ""
    for (i in 0..times) {
        result = result + str
    }
    println(result)
}

main() {
    // 使用所有默认值
    greet(name: "仓颉")
    
    // 覆盖部分默认值
    greet(name: "世界", greeting: "欢迎")
    println("---")
    
    // 不同组合使用默认值
    connect(host: "example.com")
    connect(host: "example.com", port: 443)
    connect(host: "example.com", port: 443, secure: true)
    connect(host: "localhost", secure: true)
    println("---")
    
    // 使用默认 times 参数
    repeat(str: "哈")
    
    // 覆盖默认 times 参数
    repeat(str: "* ", times: 5)
    
    // 所有参数都显式传递
    repeat(str: "OK ", times: 2)
}