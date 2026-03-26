main() {
    // 带初始值的不可变绑定
    let name = "仓颉"
    let year = 2024
    
    // 先声明类型，延迟初始化
    let text: String
    text = "仓颉造字"
    
    println("语言: ${name}")
    println("年份: ${year}")
    println("文本: ${text}")

    // 以下代码会导致编译错误：
    // name = "其他"  // 错误！let 绑定不可重新赋值
}