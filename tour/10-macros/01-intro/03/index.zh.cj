// A minimal macro declaration
// Compile with: cjc --compile-macro macro_def.cj

macro package define

import std.ast.*

// Non-attribute macro: receives input tokens, returns them unchanged
public macro testDef(input: Tokens): Tokens {
    println("Macro expanded at compile time!")
    return input
}

// Attribute macro: receives extra attribute tokens via []
public macro Annotate(attr: Tokens, input: Tokens): Tokens {
    // attr comes from @Annotate[...], input is the decorated code
    return attr + input
}
