enum Expr {
    Num(Float64) |
    Add(Expr, Expr) | Sub(Expr, Expr) | Mul(Expr, Expr) | Div(Expr, Expr)

    public func calc(): Float64 {
        match(this) {
            case Num(number) => number
            case Add(a, b) => a.calc() + b.calc()
            case Sub(a, b) => a.calc() - b.calc()
            case Mul(a, b) => a.calc() * b.calc()
            case Div(a, b) => a.calc() / b.calc()
        }
    }

    public operator func +(that: Expr): Expr {
        return Add(this, that)
    }
    public operator func -(that: Expr): Expr {
        return Sub(this, that)
    }
    public operator func *(that: Expr): Expr {
        return Mul(this, that)
    }
    public operator func /(that: Expr): Expr {
        return Div(this, that)
    }
}

main() {
    let expr = Num(1.2) + Num(3.4) * Num(2.0) - Num(1.0) / Num(2.0)
    println(expr.calc())
}
