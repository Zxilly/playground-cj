// Demonstrating macro-powered testing with @Assert
// Compile with: cjc --test main.cj

@Test
class DebugPrintConcept {
    @TestCase
    func testExpressionValues() {
        let x = 3
        let y = 2
        // @Assert checks that two values are equal at test time
        @Assert(x + y, 5)
        @Assert(x * y, 6)
        @Assert(x - y, 1)
    }
}

main() {
    // A dprint macro would expand @dprint(x + y) into:
    //   print("x + y" + " = ")
    //   println(x + y)
    // This is only possible because macros see the source tokens!
    let x = 3
    let y = 2
    println("x + y = ${x + y}")
    println("x * y = ${x * y}")
}
