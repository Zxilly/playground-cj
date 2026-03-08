func readAt(values: Array<Int64>, index: Int64): Int64 {
    return values[index]
}

main(): Int64 {
    let values = [10, 20, 30]

    try {
        let item = readAt(values, 10)
        println(item)
    } catch (e: IndexOutOfBoundsException) {
        println("Caught the specific exception first:")
        println(e)
    } catch (e: Exception) {
        println("Caught the general exception:")
        println(e)
    }

    try {
        throw ArithmeticException("division by zero is not allowed")
    } catch (e: ArithmeticException) {
        println("A different exception type can be handled separately:")
        println(e)
    }

    return 0
}
