import std.ast.*

// Construct individual tokens and combine them into a Tokens sequence
let tks = Tokens([
    Token(TokenKind.INTEGER_LITERAL, "1"),
    Token(TokenKind.ADD),
    Token(TokenKind.INTEGER_LITERAL, "2")
])

main() {
    // Print the code fragment represented by these tokens
    println("Code fragment: ${tks}")

    // Inspect individual tokens
    for (i in 0..tks.size) {
        let t = tks[i]
        println("Token ${i}: kind=${t.kind}, value=\"${t.value}\"")
    }
}
