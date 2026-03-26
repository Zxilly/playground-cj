import std.math.*

// TODO: Change this function to return Option<Float64>
// Return None when divisor is 0, otherwise return Some(result)
func divide(a: Float64, b: Float64): Option<Float64> {
    // Implement here
    None
}

// TODO: Use the ?? operator to return 0.0 when divide returns None
func safeDivide(a: Float64, b: Float64): Float64 {
    // Implement here
    0.0
}

main() {
    // Test divide function
    println("divide(10.0, 2.0) = ${divide(10.0, 2.0)}")
    println("divide(10.0, 0.0) = ${divide(10.0, 0.0)}")

    // Test safeDivide function
    println("safeDivide(10.0, 2.0) = ${safeDivide(10.0, 2.0)}")
    println("safeDivide(10.0, 0.0) = ${safeDivide(10.0, 0.0)}")

    // Expected output:
    // divide(10.0, 2.0) = Some(5.000000)
    // divide(10.0, 0.0) = None
    // safeDivide(10.0, 2.0) = 5.000000
    // safeDivide(10.0, 0.0) = 0.000000
}