// Skeleton of a macro package file
// Compile with: cjc --compile-macro macro_def.cj

macro package myMacros  // declares a macro package

import std.ast.*        // required for Tokens, Token, quote, etc.

// A simple identity macro — returns input unchanged
public macro Identity(input: Tokens): Tokens {
    return input
}
