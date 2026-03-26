// Generic function: type parameters are declared in angle brackets after the function name
func pickFirst<T>(left: T, _: T): T {
    left
}

// Generic functions can have multiple type parameters
func swap<T, U>(pair: (T, U)): (U, T) {
    let (first, second) = pair
    (second, first)
}

main() {
    // Explicitly specify type arguments
    let result1 = pickFirst<Int64>(10, 20)
    println("First value: ${result1}")

    // Or let the compiler infer the type
    let result2 = pickFirst("hello", "world")
    println("First string: ${result2}")

    // Swap the order of tuple elements
    let pair1: (String, Int64) = ("Age", 18)
    let swapped = swap<String, Int64>(pair1)
    println("After swap: ${swapped}")

    // Use type inference
    let pair2 = ("Score", 95)
    let swapped2 = swap(pair2)
    println("After swap: ${swapped2}")
}