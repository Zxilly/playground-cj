func add(a: Int64, b: Int64): Int64 {
    return a + b
}

func sayHello() {
    println("Hello, Cangjie!")
}

main() {
    let result = add(3, 5)
    println("3 + 5 = ${result}")

    sayHello()
}