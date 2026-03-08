func classify(opt: Option<Int64>): String {
    // TODO: 使用 match 实现
    ""
}

main(): Unit {
    println(classify(Some(42)))
    println(classify(Some(0)))
    println(classify(Some(-5)))
    println(classify(None))
}
