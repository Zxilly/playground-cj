// Define struct that supports compile-time construction
struct Point {
    const Point(let x: Float64, let y: Float64) {}
}

// const function: can be evaluated at compile time
// Calculate Euclidean distance between two points
const func distance(a: Point, b: Point): Float64 {
    let dx = a.x - b.x
    let dy = a.y - b.y
    (dx ** 2 + dy ** 2) ** 0.5
}

// const function: calculate sum of squares
const func sumSquares(n: Int64): Int64 {
    var total = 0
    var i = 1
    while (i <= n) {
        total += i * i
        i += 1
    }
    total
}

// const function: factorial
const func factorial(n: Int64): Int64 {
    if (n <= 1) {
        1
    } else {
        n * factorial(n - 1)
    }
}

main() {
    // Compile-time point creation and distance calculation
    const a = Point(3.0, 0.0)      // Compile-time construction
    const b = Point(0.0, 4.0)      // Compile-time construction
    const d = distance(a, b)       // Compile-time calculation, result is 5.0
    
    println("=== Compile-Time Evaluation ===")
    println("Point A: (${a.x}, ${a.y})")
    println("Point B: (${b.x}, ${b.y})")
    println("Distance: ${d}")

    // Compile-time mathematical calculations
    const sum = sumSquares(10)      // 1² + 2² + ... + 10²
    const fact = factorial(10)      // 10!
    
    println("\n=== Compile-Time Math ===")
    println("Sum of squares 1 to 10: ${sum}")
    println("Factorial of 10: ${fact}")

    // const functions can also be called at runtime
    println("\n=== Runtime Calculation ===")
    let p1 = Point(1.0, 2.0)        // Runtime construction
    let p2 = Point(4.0, 6.0)        // Runtime construction
    let dist = distance(p1, p2)     // Runtime calculation
    println("Runtime distance: ${dist}")
}