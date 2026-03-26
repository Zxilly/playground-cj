// 递归枚举：表示算术表达式
enum Expr {
    | Num(Int64)          // 数值
    | Add(Expr, Expr)     // 加法：两个子表达式
    | Mul(Expr, Expr)     // 乘法：两个子表达式
}

// 递归计算表达式的值
func eval(e: Expr): Int64 {
    match (e) {
        case Num(n) => 
            n
        case Add(left, right) => 
            eval(left) + eval(right)
        case Mul(left, right) => 
            eval(left) * eval(right)
    }
}

// 将表达式转换为字符串表示
func show(e: Expr): String {
    match (e) {
        case Num(n) => 
            "${n}"
        case Add(l, r) => 
            "(${show(l)} + ${show(r)})"
        case Mul(l, r) => 
            "(${show(l)} * ${show(r)})"
    }
}

main() {
    // 构造表达式: (2 + 3) * 4
    let expr1 = Expr.Mul(
        Expr.Add(Expr.Num(2), Expr.Num(3)),
        Expr.Num(4)
    )
    println("${show(expr1)} = ${eval(expr1)}")

    // 构造表达式: 1 + (2 * 3)
    let expr2 = Expr.Add(
        Expr.Num(1),
        Expr.Mul(Expr.Num(2), Expr.Num(3))
    )
    println("${show(expr2)} = ${eval(expr2)}")

    // 构造表达式: (10 + 20) * (3 + 4)
    let expr3 = Expr.Mul(
        Expr.Add(Expr.Num(10), Expr.Num(20)),
        Expr.Add(Expr.Num(3), Expr.Num(4))
    )
    println("${show(expr3)} = ${eval(expr3)}")
}