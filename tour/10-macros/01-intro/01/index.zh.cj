// Built-in macros in action: @Test, @TestCase, @Assert
// Compile with: cjc --test main.cj

@Test
class AddTest {
    @TestCase
    func testBasicAdd() {
        let a = 2
        let b = 3
        @Assert(a + b, 5)
    }

    @TestCase
    func testNegativeAdd() {
        @Assert(-1 + 1, 0)
    }
}

main() {
    println("Macros transform code at compile time!")
    println("@Assert(2 + 3, 5) checks equality during testing.")
}
