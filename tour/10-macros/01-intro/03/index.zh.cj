// 宏的声明与参数示例
// 编译命令: cjc macros.cj --compile-macro

macro package macros

import std.ast.*

// 非属性宏：只接收一个参数（被修饰的代码）
public macro NoChange(input: Tokens): Tokens {
    println("非属性宏被调用")
    println("输入内容: ${input.toString()}")
    return input  // 原样返回
}

// 属性宏：接收两个参数（属性和被修饰的代码）
public macro AddPrefix(attr: Tokens, input: Tokens): Tokens {
    println("属性宏被调用")
    println("属性内容: ${attr.toString()}")
    println("输入内容: ${input.toString()}")
    // 将属性和输入拼接起来
    return attr + input
}

// 使用属性的转换宏：给变量声明加上初始值
public macro Init(attr: Tokens, input: Tokens): Tokens {
    // input 是变量声明，attr 是初始值表达式
    return quote(
        $(input) = $(attr)
    )
}

// 展示参数用途的调试宏
public macro DebugShow(input: Tokens): Tokens {
    let codeStr = input.toString()
    return quote(
        println("表达式: ${$(codeStr)}")
        println("结果: ${$(input)}")
    )
}