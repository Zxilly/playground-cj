main() {
    let x = 42           // 推断为 Int64
    let y = 3.14         // 推断为 Float64
    let s = "hello"      // 推断为 String
    let b = true         // 推断为 Bool

    println("x = ${x}")
    println("y = ${y}")
    println("s = ${s}")
    println("b = ${b}")

    // 基于推断类型的后续操作
    let sum = x + 10        // sum 也是 Int64
    let product = y * 2.0   // product 也是 Float64
    let message = s + "!"   // message 也是 String
    
    println("sum = ${sum}, product = ${product}")
    println("message = ${message}")
}