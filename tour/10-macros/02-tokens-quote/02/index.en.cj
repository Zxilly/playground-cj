// Use quote() to build code
// Compile command: cjc --compile-macro macro_def.cj

macro package define

import std.ast.*

// PrintExpr macro: wraps any expression into a println call
public macro PrintExpr(input: Tokens): Tokens {
    // quote converts code template to Tokens, $(input) is interpolation
    let result = quote(
        println($(input))
    )
    return result
}

// Below is a usage example (requires a separate call file):
// 
// File: main.cj
// package main
// import define.*
// 
// main() {
//     @PrintExpr(1 + 2)      // Expands to: println(1 + 2)
//     @PrintExpr("hello")    // Expands to: println("hello")
// }
//
// Run output:
// 3
// hello