func requireAdult(age: Int64): Int64 {
    if (age < 18) {
        throw Exception("age must be at least 18")
    }
    return age
}

func divide(a: Int64, b: Int64): Int64 {
    if (b == 0) {
        throw ArithmeticException("b must not be zero")
    }
    return a / b
}

main(): Int64 {
    try {
        let age = requireAdult(16)
        println("adult age = ${age}")
    } catch (e: Exception) {
        println("Validation failed:")
        println(e)
    }

    try {
        println("20 / 4 = ${divide(20, 4)}")
        println("20 / 0 = ${divide(20, 0)}")
    } catch (e: ArithmeticException) {
        println("Math failed:")
        println(e)
    }

    return 0
}
