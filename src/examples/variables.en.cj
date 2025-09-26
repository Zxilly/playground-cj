package playground

// Example scenario: Monte Carlo algorithm for calculating π
// Features covered: constants, variables, mutability, type conversion, power operator
import std.random.*
import std.math.*

main() {
    // Constant definition names compile-time data, can be used in constant expressions
    const N = 100000u32
    // Variable definition names runtime data storage units for subsequent program reference
    // If you need to read/write this storage unit, you can use var to define mutable variables
    var n: UInt32 = 0 // You can explicitly specify the variable type
    let random = Random() // If type annotation is omitted, the variable type is determined by the initial value expression type
    for (_ in 0..N) {
        // If you only read and not write this storage unit, you can use let to define immutable variables
        let x = random.nextFloat64()
        // The initial value of immutable variables is determined at runtime, which is the biggest difference from constants
        let y = random.nextFloat64()
        // Read the value of immutable variables
        if ((x - 0.5) ** 2 + (y - 0.5) ** 2 < 0.25) {
            n++ // Modify the value of mutable variables
        }
    }
    let pi = Float64(n) / Float64(N) * 4.0
    println("π ≈ ${pi}")
    println("deviation: ${abs(Float64.PI - pi)}")
}