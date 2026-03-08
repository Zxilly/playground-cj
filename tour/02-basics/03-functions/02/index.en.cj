func multiply(a: Int64, b: Int64): Int64 {
    a * b
}

func isEven(n: Int64): Bool {
    n % 2 == 0
}

func describe(item: String): String {
    "Item: ${item}"
}

main() {
    println("4 * 7 = ${multiply(4, 7)}")
    println("10 is even? ${isEven(10)}")
    println("5 is even? ${isEven(5)}")
    println(describe("Cangjie"))
}