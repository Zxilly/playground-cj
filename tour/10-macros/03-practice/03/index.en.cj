// A complete test example using built-in macros
// Compile with: cjc --test main.cj

@Test
class FinalReview {
    @TestCase
    func testArithmetic() {
        @Assert(2 + 3, 5)
        @Assert(10 * 2, 20)
    }

    @TestCase
    func testComparison() {
        @Assert(3 > 1, true)
        @Assert(1 == 1, true)
    }
}

main() {
    println("Macros lesson complete!")
}
