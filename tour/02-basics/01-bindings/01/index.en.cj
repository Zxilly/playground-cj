main() {
    let name = "仓颉"
    let year = 2024
    let pi = 3.14159

    println("语言: ${name}")
    println("年份: ${year}")
    println("圆周率: ${pi}")

    // The following would cause a compile error:
    // name = "其他"  // Error! let bindings cannot be reassigned
}
