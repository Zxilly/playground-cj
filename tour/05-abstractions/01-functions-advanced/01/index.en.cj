// Functions are first-class citizens, can have types, be assigned to variables, and passed as parameters

func double(x: Int64): Int64 {
    x * 2
}

func square(x: Int64): Int64 {
    x * x
}

// Function type as parameter type
func apply(f: (Int64) -> Int64, value: Int64): Int64 {
    f(value)
}

main() {
    // Assign function to variable
    let fn: (Int64) -> Int64 = double
    println("fn(5) = ${fn(5)}")
    
    // Function as parameter
    println("apply(double, 4) = ${apply(double, 4)}")
    println("apply(square, 4) = ${apply(square, 4)}")
    
    // Declared with var can be reassigned
    var operation = double
    println("operation(3) = ${operation(3)}")
    operation = square
    println("operation(3) = ${operation(3)}")
}