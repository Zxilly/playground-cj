main() {
    // if 表达式返回值赋给变量
    let temperature = 28
    let weather = if (temperature > 30) {
        "炎热"
    } else if (temperature > 20) {
        "温暖"
    } else {
        "凉爽"
    }
    println("温度 ${temperature}°C: ${weather}")

    // 用于计算绝对值
    let x = -15
    let abs = if (x >= 0) { x } else { -x }
    println("${x} 的绝对值是 ${abs}")

    // 用于求两数中的较大值
    let a = 10
    let b = 20
    let max = if (a > b) { a } else { b }
    println("${a} 和 ${b} 中较大的是 ${max}")

    // 用于条件赋值
    let score = 75
    let status = if (score >= 60) { "通过" } else { "未通过" }
    println("成绩 ${score}: ${status}")
}