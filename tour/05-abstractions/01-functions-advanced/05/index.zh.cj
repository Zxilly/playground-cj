// 函数重载：同名函数，不同参数

func format(value: Int64): String {
    "整数: ${value}"
}

func format(value: Float64): String {
    "浮点数: ${value}"
}

func format(value: String): String {
    "字符串: \"${value}\""
}

// 参数个数不同
func format(a: Int64, b: Int64): String {
    "整数对: (${a}, ${b})"
}

// 布尔类型重载
func format(value: Bool): String {
    "布尔值: ${value}"
}

// 数组类型重载
func format(values: Array<Int64>): String {
    var result = "数组: ["
    for (i in 0..values.size) {
        result = result + "${values[i]}"
        if (i < values.size - 1) {
            result = result + ", "
        }
    }
    result + "]"
}

main() {
    // 编译器根据实参类型选择重载版本
    println(format(42))              // 整数版本
    println(format(3.14159))         // 浮点数版本
    println(format("hello"))         // 字符串版本
    println(format(1, 2))            // 双整数版本
    println(format(true))            // 布尔版本
    println(format([1, 2, 3, 4, 5])) // 数组版本
}