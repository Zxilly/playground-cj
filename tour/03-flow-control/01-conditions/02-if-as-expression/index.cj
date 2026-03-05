main() {
    let temperature = 28

    // if 作为表达式，结果赋值给变量
    let weather = if (temperature > 30) {
        "炎热"
    } else if (temperature > 20) {
        "温暖"
    } else {
        "凉爽"
    }
    println("天气: ${weather}")

    // 用于计算
    let x = 15
    let abs = if (x >= 0) { x } else { -x }
    println("${x} 的绝对值: ${abs}")

    let max = if (10 > 20) { 10 } else { 20 }
    println("较大值: ${max}")
}
