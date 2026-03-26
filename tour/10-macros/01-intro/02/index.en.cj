// Macro package definition example
// Compile command: cjc define.cj --compile-macro

macro package myMacros  // Declare a macro package

import std.ast.*        // Must import AST tools

// Identity macro: receives input and returns it unchanged
public macro Identity(input: Tokens): Tokens {
    println("Compile time: Identity macro called")
    println("Input Tokens: ${input.toString()}")
    return input  // Return original input, no transformation
}

// Logging macro: adds print statement before code
public macro Log(input: Tokens): Tokens {
    let inputStr = input.toString()
    return quote(
        println("Debug: executing ${inputStr}")
        $(input)
    )
}

// Double computation macro: generates the expression twice
public macro Twice(input: Tokens): Tokens {
    return quote(
        ($(input) + $(input))
    )
}