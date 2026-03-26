main() {
    // Default floating-point type is Float64
    let distance = 5.5
    let time = 2.0
    let speed = distance / time

    println("Distance: ${distance} km")
    println("Time: ${time} h")
    println("Average speed: ${speed} km/h")

    // Scientific notation (decimal)
    let large = 2.5e10      // 2.5 × 10^10
    let small = 1.2e-5      // 1.2 × 10^-5
    let compact = .5e2      // 0.5 × 10^2 = 50.0
    println("Large number: ${large}")
    println("Small number: ${small}")
    println("Compact notation: ${compact}")

    // Hexadecimal floating-point (p indicates exponent, base 2)
    let hexFloat = 0x1.5p2  // (1 + 5/16) × 2^2 = 5.25
    let hexSimple = 0x1p3   // 1 × 2^3 = 8.0
    println("Hexadecimal float: ${hexFloat}")
    println("Simplified form: ${hexSimple}")

    // Specify type using suffix
    let precise = 3.14159265358979f64
    let compact32 = 3.14f32
    let half = 1.5f16
    println("Double precision: ${precise}")
    println("Single precision: ${compact32}")
    println("Half precision: ${half}")

    // Practical application
    let price = 99.9
    let quantity = 3
    println("Total price: ${price * Float64(quantity)}")
}