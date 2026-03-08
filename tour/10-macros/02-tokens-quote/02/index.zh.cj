// Using quote() to build code as Tokens inside a macro
// Compile with: cjc --compile-macro macro_def.cj

macro package define

import std.ast.*

// This macro wraps any expression in a println() call
public macro PrintExpr(input: Tokens): Tokens {
    let result = quote(
        println($(input))
    )
    return result
}

// Usage (in a separate file):
//   import define.*
//   main() {
//       @PrintExpr(1 + 2)  // expands to: println(1 + 2)
//   }
