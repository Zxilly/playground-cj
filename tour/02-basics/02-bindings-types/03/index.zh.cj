main() {
    let score: Int64 = 95
    let title: String = "仓颉入门"
    let ready: Bool = true

    println("分数: ${score}")
    println("标题: ${title}")
    println("准备好了: ${ready}")

    // 类型不匹配会编译报错
    // let wrong: Bool = 42  // 错误！不能用整数初始化 Bool 类型
    
    // 类型标注可以窄化字面量类型
    let small: Int32 = 100  // 100 本来推断为 Int64，这里变成 Int32
    println("小整数: ${small}")
}