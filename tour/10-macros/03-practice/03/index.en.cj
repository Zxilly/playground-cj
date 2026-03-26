// Macro learning completion summary
// This example comprehensively demonstrates the use of test macros

import std.unittest.*
import std.unittest.testmacro.*

@Test
class FinalReview {
    @TestCase
    func testBasicOperations() {
        // Use @Expect for assertions
        @Expect(2 + 3, 5)
        @Expect(10 * 2, 20)
        @Expect(15 / 3, 5)
        @Expect(17 % 5, 2)
    }
    
    @TestCase
    func testStringOperations() {
        let greeting = "Hello"
        let name = "Cangjie"
        @Expect(greeting + name, "HelloCangjie")
        @Expect(greeting.size, 2)
    }
    
    @TestCase
    func testBooleanLogic() {
        @Expect(true && true, true)
        @Expect(true || false, true)
        @Expect(!false, true)
    }
}

main() {
    println("Macro chapter completed!")
    println("")
    println("Key points review:")
    println("1. Macros expand at compile time and can access source code tokens")
    println("2. Use quote templates and $() interpolation to generate code")
    println("3. Macros must be defined in separate packages")
    println("4. Use --debug-macro to view expansion results")
    println("5. Use diagReport in macros for error reporting")
    println("")
    println("Continue exploring the Cangjie language!")
}