// Function overloading: same function name, different parameters

func format(value: Int64): String {
    "Integer: ${value}"
}

func format(value: Float64): String {
    "Float: ${value}"
}

func format(value: String): String {
    "String: \"${value}\""
}

// Different number of parameters
func format(a: Int64, b: Int64): String {
    "Integer pair: (${a}, ${b})"
}

// Boolean type overload
func format(value: Bool): String {
    "Boolean: ${value}"
}

// Array type overload
func format(values: Array<Int64>): String {
    var result = "Array: ["
    for (i in 0..values.size) {
        result = result + "${values[i]}"
        if (i < values.size - 1) {
            result = result + ", "
        }
    }
    result + "]"
}

main() {
    // Compiler selects overload version based on argument types
    println(format(42))              // Integer version
    println(format(3.14159))         // Float version
    println(format("hello"))         // String version
    println(format(1, 2))            // Dual integer version
    println(format(true))            // Boolean version
    println(format([1, 2, 3, 4, 5])) // Array version
}