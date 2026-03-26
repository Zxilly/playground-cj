import std.math.sqrt
import std.math.PI

main() {
    // Use imported sqrt function to calculate square root
    let a = 16
    let root = sqrt(Float64(a))
    println("The square root of ${a} is ${root}")
    
    // Use imported PI constant
    let radius = 5.0
    let area = PI * radius * radius
    println("The area of a circle with radius ${radius} is ${area}")
    
    // Calculate circle circumference
    let circumference = 2 * PI * radius
    println("The circumference is ${circumference}")
    
    // Another square root calculation
    let b = 64
    let rootB = sqrt(Float64(b))
    println("The square root of ${b} is ${rootB}")
}