func format(value: Int64): String {
    "Integer: ${value}"
}

func format(value: Float64): String {
    "Float: ${value}"
}

func format(value: String): String {
    "String: \"${value}\""
}

func format(a: Int64, b: Int64): String {
    "Pair: (${a}, ${b})"
}

main() {
    println(format(42))
    println(format(3.14))
    println(format("hello"))
    println(format(1, 2))
}