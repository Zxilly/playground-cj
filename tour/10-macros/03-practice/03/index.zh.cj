// 宏学习完成总结
// 这个示例综合展示了测试宏的使用

import std.unittest.*
import std.unittest.testmacro.*

@Test
class FinalReview {
    @TestCase
    func testBasicOperations() {
        // 使用 @Expect 进行断言
        @Expect(2 + 3, 5)
        @Expect(10 * 2, 20)
        @Expect(15 / 3, 5)
        @Expect(17 % 5, 2)
    }
    
    @TestCase
    func testStringOperations() {
        let greeting = "你好"
        let name = "仓颉"
        @Expect(greeting + name, "你好仓颉")
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
    println("宏章节学习完成！")
    println("")
    println("要点回顾：")
    println("1. 宏在编译期展开，可以访问源代码 token")
    println("2. 使用 quote模板 和 $() 插值生成代码")
    println("3. 宏必须定义在独立的包中")
    println("4. 使用 --debug-macro 查看展开结果")
    println("5. 在宏中使用 diagReport 进行错误报告")
    println("")
    println("继续探索仓颉语言吧！")
}