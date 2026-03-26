func classify(opt: Option<Int64>): String {
    // TODO: 使用 match 表达式实现
    // 提示：
    // - 使用 case Some(x) 匹配 Some 构造器
    // - 使用 case None 匹配 None
    // - 结合 where 守卫判断正负
    // - 使用字符串插值显示具体值
    ""
}

main() {
    println(classify(Some(42)))    // 应输出: positive: 42
    println(classify(Some(0)))     // 应输出: zero
    println(classify(Some(-5)))    // 应输出: negative: -5
    println(classify(None))        // 应输出: none
}