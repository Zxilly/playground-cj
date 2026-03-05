main() {
    // Exception is the base class for all exceptions
    let e = Exception("Something went wrong")
    println("Exception message: ${e.message}")

    // Attempting operations that may throw
    let arr = [1, 2, 3]

    // Catching a specific error
    try {
        let _ = arr[10]
    } catch (e: IndexOutOfBoundsException) {
        println("Caught index error: ${e.message}")
    } catch (e: Exception) {
        println("Caught general error: ${e.message}")
    }

    // Arithmetic errors
    try {
        let x: Int64 = 0
        if (x == 0) {
            throw ArithmeticException("Cannot divide by zero")
        }
    } catch (e: ArithmeticException) {
        println("Caught arithmetic error: ${e.message}")
    }

    println("Program continues after handling exceptions")
}