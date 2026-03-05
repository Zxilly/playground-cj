func apply(f: (Int64) -> Int64, value: Int64): Int64 {
    f(value)
}

main() {
    // Lambda assigned to a variable
    let double = { x: Int64 => x * 2 }
    println("double(5) = ${double(5)}")

    // Lambda with multiple statements
    let abs = { x: Int64 =>
        if (x < 0) { -x } else { x }
    }
    println("abs(-3) = ${abs(-3)}")

    // Lambda as function argument
    println("apply triple to 4: ${apply({ x: Int64 => x * 3 }, 4)}")

    // No-parameter lambda
    let greet = { => "Hello, Lambda!" }
    println(greet())
}