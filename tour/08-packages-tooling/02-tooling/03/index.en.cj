// Build with: cjpm build
// Run with:   cjpm run
// Test with:  cjpm test

func add(a: Int64, b: Int64): Int64 {
    a + b
}

func multiply(a: Int64, b: Int64): Int64 {
    a * b
}

main(): Unit {
    println("2 + 3 = ${add(2, 3)}")
    println("4 * 5 = ${multiply(4, 5)}")
}
