enum Expr {
    | Num(Int64)
    | Add(Expr, Expr)
    | Mul(Expr, Expr)
}

func eval(e: Expr): Int64 {
    match (e) {
        case Num(n) => n
        case Add(left, right) => eval(left) + eval(right)
        case Mul(left, right) => eval(left) * eval(right)
    }
}

func show(e: Expr): String {
    match (e) {
        case Num(n) => "${n}"
        case Add(l, r) => "(${show(l)} + ${show(r)})"
        case Mul(l, r) => "(${show(l)} * ${show(r)})"
    }
}

main() {
    // (2 + 3) * 4
    let expr = Expr.Mul(
        Expr.Add(Expr.Num(2), Expr.Num(3)),
        Expr.Num(4)
    )
    println("${show(expr)} = ${eval(expr)}")

    // 1 + (2 * 3)
    let expr2 = Expr.Add(
        Expr.Num(1),
        Expr.Mul(Expr.Num(2), Expr.Num(3))
    )
    println("${show(expr2)} = ${eval(expr2)}")
}