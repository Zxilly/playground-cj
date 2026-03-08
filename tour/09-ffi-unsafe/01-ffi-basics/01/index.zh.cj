// 使用 `foreign` 声明 C 标准库函数。
// foreign 声明上的 @C 注解可以省略。
foreign func rand(): Int32
foreign func abs(x: Int32): Int32

main() {
    // foreign 函数必须在 `unsafe` 块中调用。
    let r = unsafe { rand() }
    println("Random number: ${r}")

    let result = unsafe { abs(-42) }
    println("abs(-42) = ${result}")
}
