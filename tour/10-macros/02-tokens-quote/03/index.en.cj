// quote interpolation details
// Compile command: cjc --compile-macro macro_def.cj

macro package define

import std.ast.*

// dprint debug macro: prints expression and its value
public macro dprint(input: Tokens): Tokens {
    // Get string representation of input expression
    let inputStr = input.toString()  // e.g., "x + y"
    
    // Use interpolation to build output code
    // $(inputStr) inserts string value, yielding "x + y"
    // $(input) inserts original Tokens, yielding code x + y
    let result = quote(
        print($(inputStr) + " = ")   // Print expression text
        println($(input))            // Print expression value
    )
    return result
}

// Usage example (requires a separate call file):
// 
// File: main.cj
// package main
// import define.*
// 
// main() {
//     let x = 10
//     let y = 5
//     @dprint(x + y)       // Output: x + y = 15
//     @dprint(x * 2)       // Output: x * 2 = 20
//     @dprint(x)           // Output: x = 10
// }

// More interpolation type examples (inside macro body):
// 
// let num: Int64 = 42
// let text: String = "hello"
// let arr: Array<Int64> = [1, 2, 3]
// 
// let tokens = quote(
//     let a = $(num)        // Insert integer, yielding 42
//     let b = $(text)       // Insert string, yielding "hello"
//     let c = $(arr)        // Insert array, yielding [1, 2, 3]
// )