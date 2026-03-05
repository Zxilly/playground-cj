func double(x: Int64): Int64 {
    x * 2
}

func square(x: Int64): Int64 {
    x * x
}

func apply(f: (Int64) -> Int64, value: Int64): Int64 {
    f(value)
}

main() {
    let fn: (Int64) -> Int64 = double
    println("double(5) = ${fn(5)}")

    println("apply(double, 4) = ${apply(double, 4)}")
    println("apply(square, 4) = ${apply(square, 4)}")

    // Functions can be reassigned to variables
    var operation = double
    println("operation(3) = ${operation(3)}")
    operation = square
    println("operation(3) = ${operation(3)}")
}