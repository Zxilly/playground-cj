extend Int64 {
    func isEven(): Bool {
        return this % 2 == 0
    }

    func isPositive(): Bool {
        return this > 0
    }

    func abs(): Int64 {
        if (this < 0) {
            return -this
        }
        return this
    }
}

main() {
    let n = 42
    println("${n} is even: ${n.isEven()}")
    println("${n} is positive: ${n.isPositive()}")

    let m = -7
    println("${m} is even: ${m.isEven()}")
    println("abs(${m}) = ${m.abs()}")
}