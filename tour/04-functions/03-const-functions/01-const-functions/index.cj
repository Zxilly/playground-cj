const func factorial(n: Int64): Int64 {
    if (n <= 1) {
        return 1
    }
    n * factorial(n - 1)
}

const func square(x: Int64): Int64 {
    x * x
}

main() {
    // These can be evaluated at compile time
    const let fact5 = factorial(5)
    const let sq10 = square(10)

    println("5! = ${fact5}")
    println("10^2 = ${sq10}")

    // const functions can also be called at runtime
    var n = 7
    println("${n}! = ${factorial(n)}")
}