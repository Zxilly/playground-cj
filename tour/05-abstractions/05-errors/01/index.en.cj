func readAt(values: Array<Int64>, index: Int64): Int64 {
    values[index]
}

main() {
    let values = [10, 20, 30]

    // Correct order: specific types first, generic types later
    try {
        let item = readAt(values, 10)
        println(item)
    } catch (e: IndexOutOfBoundsException) {
        println("Caught specific exception: ${e.message}")
    } catch (e: Exception) {
        println("Caught generic exception: ${e.message}")
    }

    // Different exception types can be handled separately
    try {
        throw ArithmeticException("Divisor cannot be zero")
    } catch (e: ArithmeticException) {
        println("Arithmetic exception: ${e.message}")
    } catch (e: IllegalArgumentException) {
        println("Argument exception: ${e.message}")
    } catch (e: Exception) {
        println("Other exception: ${e.message}")
    }

    println("Program continues...")
}