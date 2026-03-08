func divide(a: Float64, b: Float64): Float64 {
    if (b == 0.0) {
        throw IllegalArgumentException("division by zero")
    }
    a / b
}

main(): Unit {
    try {
        println(divide(10.0, 2.0))
        println(divide(10.0, 0.0))
    } catch (e: IllegalArgumentException) {
        println("Error: ${e.message}")
    }
}
