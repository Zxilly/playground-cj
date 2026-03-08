@Test
class MyTests {
    @TestCase
    func testAddition(): Unit {
        @Assert(1 + 1, 2)
    }
}

main(): Unit {
    println("Run with cjc test to execute @TestCase methods")
}
