main() {
    // 定义不可变绑定，类型由初始值自动推断
    let name = "仓颉"
    let year = 2024
    let pi = 3.14159
    
    println("语言: ${name}")
    println("年份: ${year}")
    println("圆周率: ${pi}")
    
    // 以下代码会导致编译错误：
    // name = "其他"  // 错误！let 绑定不可修改
}