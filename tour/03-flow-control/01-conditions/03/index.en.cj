main() {
    let a: ?Int64 = Some(42)
    let b: ?Int64 = None

    // if-let unwraps an Option
    if (let Some(value) <- a) {
        println("a 的值: ${value}")
    } else {
        println("a 为空")
    }

    if (let Some(value) <- b) {
        println("b 的值: ${value}")
    } else {
        println("b 为空")
    }

    // Combined with a condition check
    let x: ?Int64 = Some(10)
    if (let Some(v) <- x && v > 5) {
        println("${v} 大于 5")
    }
}
