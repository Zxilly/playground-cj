main() {
    // Basic floating-point operations
    let distance = 5.5       // Default Float64
    let time = 2.0
    let speed = distance / time
    println("Distance: ${distance} km")
    println("Time: ${time} h")
    println("Average speed: ${speed} km/h")

    // Scientific notation
    let scientific = 2.4e-1  // 0.24
    println("Scientific notation 2.4e-1 = ${scientific}")

    // Using suffixes to specify types
    let pi: Float32 = 3.14159f32
    let e = 2.718f64
    println("π ≈ ${pi}")
    println("e ≈ ${e}")

    // Hexadecimal floating-point literal
    let hexFloat = 0x1.1p0   // 1.0625
    println("Hexadecimal float 0x1.1p0 = ${hexFloat}")

    // Floating-point operations
    let avg = (72.5 + 81.0) / 2.0
    println("Average score: ${avg}")
}