// Macro declaration and parameters example
// Compile command: cjc macros.cj --compile-macro

macro package macros

import std.ast.*

// Non-attribute macro: receives only one parameter (the decorated code)
public macro NoChange(input: Tokens): Tokens {
    println("Non-attribute macro called")
    println("Input content: ${input.toString()}")
    return input  // Return unchanged
}

// Attribute macro: receives two parameters (attribute and decorated code)
public macro AddPrefix(attr: Tokens, input: Tokens): Tokens {
    println("Attribute macro called")
    println("Attribute content: ${attr.toString()}")
    println("Input content: ${input.toString()}")
    // Concatenate attribute and input
    return attr + input
}

// Transformation macro using attribute: adds initial value to variable declaration
public macro Init(attr: Tokens, input: Tokens): Tokens {
    // input is variable declaration, attr is initial value expression
    return quote(
        $(input) = $(attr)
    )
}

// Debug macro demonstrating parameter usage
public macro DebugShow(input: Tokens): Tokens {
    let codeStr = input.toString()
    return quote(
        println("Expression: ${$(codeStr)}")
        println("Result: ${$(input)}")
    )
}