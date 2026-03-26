// 使用内置测试宏的示例
// 编译命令: cjc --test main.cj
// 调试宏展开: cjc --test --debug-macro main.cj

import std.unittest.*
import std.unittest.testmacro.*

@Test
class MacroDebugDemo {
    @TestCase
    func testArithmetic() {
        // @Expect 检查两个值是否相等
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
        // @Expect 也可以用于布尔表达式
        @Expect(3 > 1, true)
        @Expect(1 == 1, true)
        @Expect(5 <= 10, true)
    }
}

main() {
    println("使用 --debug-macro 选项查看宏展开后的代码")
    println("生成的 .macrocall 文件包含展开结果")
    println("在宏定义中使用 diagReport() 可输出编译器风格的错误")
}