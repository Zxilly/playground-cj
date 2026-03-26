// 使用 quote() 构建代码
// 编译命令: cjc --compile-macro macro_def.cj

macro package define

import std.ast.*

// PrintExpr 宏：将任意表达式包装成 println 调用
public macro PrintExpr(input: Tokens): Tokens {
    // quote 将代码模板转换为 Tokens，$(input) 是插值
    let result = quote(
        println($(input))
    )
    return result
}

// 以下是使用示例（需要单独的调用文件）:
// 
// 文件: main.cj
// package main
// import define.*
// 
// main() {
//     @PrintExpr(1 + 2)      // 展开为: println(1 + 2)
//     @PrintExpr("hello")    // 展开为: println("hello")
// }
//
// 运行输出:
// 3
// hello