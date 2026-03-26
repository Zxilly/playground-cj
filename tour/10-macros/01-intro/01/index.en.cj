// Built-in test macro example
// Compile command: cjc --test main.cj -o main && ./main

import std.unittest.*
import std.unittest.testmacro.*

@Test
class AddTest {
    @TestCase
    func testBasicAdd() {
        let a = 2
        let b = 3
        @Assert(a + b, 5)  // Check if 2 + 3 equals 5
    }

    @TestCase
    func testNegativeAdd() {
        // Test negative number addition
        @Assert(-1 + 1, 0)
    }

    @TestCase
    func testWithExpression() {
        let x = 10
        @Assert(x * 2, 20)  // Check if x * 2 equals 20
    }
}

main() {
    println("This is a test macro example")
    println("Use the --test option when compiling in practice")
}