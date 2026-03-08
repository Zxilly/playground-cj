func classify(opt: Option<Int64>): String {
    // TODO: implement using match
    ""
}

main(): Unit {
    println(classify(Some(42)))
    println(classify(Some(0)))
    println(classify(Some(-5)))
    println(classify(None))
}
