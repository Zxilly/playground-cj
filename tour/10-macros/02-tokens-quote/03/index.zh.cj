// Interpolation with $() inside quote expressions
// Compile with: cjc --compile-macro macro_def.cj

macro package define

import std.ast.*

// dprint macro: prints both the expression text and its value
public macro dprint(input: Tokens): Tokens {
    let inputStr = input.toString()  // "x + y"
    let result = quote(
        print($(inputStr) + " = ")   // $(inputStr) splices the string
        println($(input))            // $(input) splices the actual tokens
    )
    return result
}

// Usage (in a separate file):
//   import define.*
//   main() {
//       let x = 3
//       let y = 2
//       @dprint(x + y)  // prints: x + y = 5
//   }
