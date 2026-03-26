import std.ast.*

main() {
    // 手动构造三个 Token：整数字面量 1、加号运算符、整数字面量 2
    let t1 = Token(TokenKind.INTEGER_LITERAL, "1")
    let t2 = Token(TokenKind.ADD)
    let t3 = Token(TokenKind.INTEGER_LITERAL, "2")
    
    // 将 Token 组合成 Tokens 序列
    let tokens = Tokens([t1, t2, t3])
    
    // 打印 Tokens 对应的代码片段
    println("代码片段: ${tokens}")
    println("Token 数量: ${tokens.size}")
    
    // 遍历查看每个 Token 的类型和值
    for (i in 0..tokens.size) {
        let t = tokens[i]
        println("Token[${i}]: kind=${t.kind}, value=\"${t.value}\"")
    }
    
    // 演示 Tokens 的拼接操作
    let extraTokens = Tokens([Token(TokenKind.ADD), Token(TokenKind.INTEGER_LITERAL, "3")])
    let combined = tokens + extraTokens
    println("拼接后: ${combined}")
}