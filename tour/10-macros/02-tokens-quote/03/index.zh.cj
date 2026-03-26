// quote 插值详解
// 编译命令: cjc --compile-macro macro_def.cj

macro package define

import std.ast.*

// dprint 调试宏：打印表达式及其值
public macro dprint(input: Tokens): Tokens {
    // 获取输入表达式的字符串表示
    let inputStr = input.toString()  // 例如 "x + y"
    
    // 使用插值构建输出代码
    // $(inputStr) 插入字符串值，得到 "x + y"
    // $(input) 插入原始 Tokens，得到代码 x + y
    let result = quote(
        print($(inputStr) + " = ")   // 打印表达式文本
        println($(input))            // 打印表达式值
    )
    return result
}

// 使用示例（需要单独的调用文件）:
// 
// 文件: main.cj
// package main
// import define.*
// 
// main() {
//     let x = 10
//     let y = 5
//     @dprint(x + y)       // 输出: x + y = 15
//     @dprint(x * 2)       // 输出: x * 2 = 20
//     @dprint(x)           // 输出: x = 10
// }

// 更多插值类型示例（在宏体内）:
// 
// let num: Int64 = 42
// let text: String = "hello"
// let arr: Array<Int64> = [1, 2, 3]
// 
// let tokens = quote(
//     let a = $(num)        // 插入整数，得到 42
//     let b = $(text)       // 插入字符串，得到 "hello"
//     let c = $(arr)        // 插入数组，得到 [1, 2, 3]
// )