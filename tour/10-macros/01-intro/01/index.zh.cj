// 内置测试宏示例
// 编译命令: cjc --test main.cj -o main && ./main

import std.unittest.*
import std.unittest.testmacro.*

@Test
class AddTest {
    @TestCase
    func testBasicAdd() {
        let a = 2
        let b = 3
        @Assert(a + b, 5)  // 检查 2 + 3 是否等于 5
    }

    @TestCase
    func testNegativeAdd() {
        // 测试负数加法
        @Assert(-1 + 1, 0)
    }

    @TestCase
    func testWithExpression() {
        let x = 10
        @Assert(x * 2, 20)  // 检查 x * 2 是否等于 20
    }
}

main() {
    println("这是一个测试宏示例")
    println("实际使用时需要用 --test 选项编译")
}