func classify(opt: Option<Int64>): String {
    // TODO: Implement using match expression
    // Hints:
    // - Use case Some(x) to match the Some constructor
    // - Use case None to match None
    // - Combine with where guard to check positive/negative
    // - Use string interpolation to show specific values
    ""
}

main() {
    println(classify(Some(42)))    // Should output: positive: 42
    println(classify(Some(0)))     // Should output: zero
    println(classify(Some(-5)))    // Should output: negative: -5
    println(classify(None))        // Should output: none
}