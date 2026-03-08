main() {
    let temperature = 28

    // if as an expression, result assigned to a variable
    let weather = if (temperature > 30) {
        "炎热"
    } else if (temperature > 20) {
        "温暖"
    } else {
        "凉爽"
    }
    println("天气: ${weather}")

    // Used in computation
    let x = 15
    let abs = if (x >= 0) { x } else { -x }
    println("${x} 的绝对值: ${abs}")

    let max = if (10 > 20) { 10 } else { 20 }
    println("较大值: ${max}")
}
