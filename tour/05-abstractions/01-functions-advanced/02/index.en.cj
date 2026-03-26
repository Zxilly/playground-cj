// Lambda expressions: concise syntax for anonymous functions

func apply(f: (Int64) -> Int64, value: Int64): Int64 {
    f(value)
}

main() {
    // Lambda assigned to variable (parameter type can be omitted)
    let double = { x: Int64 => x * 2 }
    println("double(5) = ${double(5)}")
    
    // Multi-line lambda: if expression is also an expression
    let abs = { x: Int64 =>
        if (x < 0) { -x } else { x }
    }
    println("abs(-3) = ${abs(-3)}")
    println("abs(7) = ${abs(7)}")
    
    // Lambda passed directly as function parameter
    let result = apply({ x: Int64 => x * 3 }, 4)
    println("apply(triple function, 4) = ${result}")
    
    // Parameterless lambda
    let greet = { => "Hello, Lambda!" }
    println(greet())
    
    // Lambda immediate invocation
    let sum = { a: Int64, b: Int64 => a + b }(10, 20)
    println("Immediate invocation result: ${sum}")
}