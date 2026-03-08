// Using built-in test macros: @Test, @TestCase, @Expect
// Compile with: cjc --test main.cj
// Debug macro expansion: cjc --test --debug-macro main.cj

@Test
class MacroDebugDemo {
    @TestCase
    func testAddition() {
        @Expect(1 + 1, 2)
        @Expect(10 - 3, 7)
    }

    @TestCase
    func testStringLength() {
        let s = "hello"
        @Expect(s.size, 5)
    }
}

main() {
    println("Use --debug-macro to see expanded macro code")
    println("Use diagReport() inside macros to report errors")
}
