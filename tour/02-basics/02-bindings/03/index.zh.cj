main() {
    // 使用类型标注显式指定变量类型
    let score: Int64 = 95
    let title: String = "仓颉语言"
    let ready: Bool = true
    let price: Float64 = 19.99
    
    println("分数: ${score}")
    println("标题: ${title}")
    println("准备好了吗: ${ready}")
    println("价格: ${price}")
    
    // 类型标注帮助编译器捕获错误：
    // let wrong: Int64 = "字符串"  // 错误！类型不匹配
}