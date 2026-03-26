// Example of using built-in test macros
// Compile command: cjc --test main.cj
// Debug macro expansion: cjc --test --debug-macro main.cj

import std.unittest.*
import std.unittest.testmacro.*

@Test
class MacroDebugDemo {
    @TestCase
    func testArithmetic() {
        // @Expect checks if two values are equal
        @Expect(1 + 1, 2)
        @Expect(10 - 3, 7)
        @Expect(2 * 3, 6)
    }
    
    @TestCase
    func testStringLength() {
        let s = "hello"
        @Expect(s.size, 5)
        @Expect(s + " world", "hello world")
    }
    
    @TestCase
    func testComparison() {
        // @Expect can also be used for boolean expressions
        @Expect(3 > 1, true)
        @Expect(1 == 1, true)
        @Expect(5 <= 10, true)
    }
}

main() {
    println("Use --debug-macro option to view macro-expanded code")
    println("Generated .macrocall file contains expansion results")
    println("Use diagReport() in macro definitions to output compiler-style errors")
}