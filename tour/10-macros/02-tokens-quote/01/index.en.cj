import std.ast.*

main() {
    // Manually construct three Tokens: integer literal 1, plus operator, integer literal 2
    let t1 = Token(TokenKind.INTEGER_LITERAL, "1")
    let t2 = Token(TokenKind.ADD)
    let t3 = Token(TokenKind.INTEGER_LITERAL, "2")
    
    // Combine Tokens into a Tokens sequence
    let tokens = Tokens([t1, t2, t3])
    
    // Print the code fragment corresponding to Tokens
    println("Code fragment: ${tokens}")
    println("Token count: ${tokens.size}")
    
    // Iterate to view each Token's type and value
    for (i in 0..tokens.size) {
        let t = tokens[i]
        println("Token[${i}]: kind=${t.kind}, value=\"${t.value}\"")
    }
    
    // Demonstrate Tokens concatenation operation
    let extraTokens = Tokens([Token(TokenKind.ADD), Token(TokenKind.INTEGER_LITERAL, "3")])
    let combined = tokens + extraTokens
    println("After concatenation: ${combined}")
}