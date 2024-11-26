func iter(n: Int64, x0: Float64, f: (Float64) -> Float64) {
    var x = x0
    for (_ in 0..n) {
        print("${x}, ")
        x = f(x)
    }
    println("${x}")
}

main() {
    iter(5, 0.8, { x: Float64 => 1.0 / (1.0 - x)})
    iter(10, 0.8, { x: Float64 =>
        4.0 * x * (1.0 - x)
    })
}
