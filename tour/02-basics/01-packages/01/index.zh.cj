// 程序从 main 函数开始执行
// 返回 Int64 类型的退出码
main(): Int64 {
    // 打印欢迎信息
    println("你好，仓颉！")
    println("欢迎来到仓颉编程世界")
    
    // 简单的数学计算
    let year = 2024
    let birth = 2019
    println("仓颉语言发布于 ${year} 年")
    println("从立项到发布历时 ${year - birth} 年")
    
    // 字符串操作
    let lang = "仓颉"
    let founder = "华为"
    println("${lang} 由 ${founder} 开发")
    
    // 返回 0 表示正常退出
    println("程序即将退出")
    return 0
}