main() {
    let x = 42          // 推断为 Int64
    let y = 3.14        // 推断为 Float64
    let s = "hello"     // 推断为 String
    let b = true        // 推断为 Bool
    let c = r'A'        // 推断为 Rune

    println("x = ${x}")
    println("y = ${y}")
    println("s = ${s}")
    println("b = ${b}")
    println("c = ${c}")
}
