// Recursive enum: representing arithmetic expressions
enum Expr {
    | Num(Int64)          // Number
    | Add(Expr, Expr)     // Addition: two sub-expressions
    | Mul(Expr, Expr)     // Multiplication: two sub-expressions
}

// Recursively calculate the value of an expression
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

// Convert an expression to string representation
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
    // Construct expression: (2 + 3) * 4
    let expr1 = Expr.Mul(
        Expr.Add(Expr.Num(2), Expr.Num(3)),
        Expr.Num(4)
    )
    println("${show(expr1)} = ${eval(expr1)}")

    // Construct expression: 1 + (2 * 3)
    let expr2 = Expr.Add(
        Expr.Num(1),
        Expr.Mul(Expr.Num(2), Expr.Num(3))
    )
    println("${show(expr2)} = ${eval(expr2)}")

    // Construct expression: (10 + 20) * (3 + 4)
    let expr3 = Expr.Mul(
        Expr.Add(Expr.Num(10), Expr.Num(20)),
        Expr.Add(Expr.Num(3), Expr.Num(4))
    )
    println("${show(expr3)} = ${eval(expr3)}")