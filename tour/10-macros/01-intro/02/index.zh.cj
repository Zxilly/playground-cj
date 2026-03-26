// 宏包定义示例
// 编译命令: cjc define.cj --compile-macro

macro package myMacros  // 声明一个宏包

import std.ast.*        // 必须导入 AST 工具

// 恒等宏：接收输入并原样返回
public macro Identity(input: Tokens): Tokens {
    println("编译期：Identity 宏被调用")
    println("输入 Tokens: ${input.toString()}")
    return input  // 返回原始输入，不做转换
}

// 添加日志的宏：在代码前添加打印语句
public macro Log(input: Tokens): Tokens {
    let inputStr = input.toString()
    return quote(
        println("调试: 执行 ${inputStr}")
        $(input)
    )
}

// 双重计算的宏：生成两遍表达式
public macro Twice(input: Tokens): Tokens {
    return quote(
        ($(input) + $(input))
    )
}