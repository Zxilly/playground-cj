main() {
    // 浮点数基本运算
    let distance = 5.5       // 默认 Float64
    let time = 2.0
    let speed = distance / time
    println("距离: ${distance} km")
    println("时间: ${time} h")
    println("平均速度: ${speed} km/h")

    // 科学计数法
    let scientific = 2.4e-1  // 0.24
    println("科学计数法 2.4e-1 = ${scientific}")

    // 使用后缀指定类型
    let pi: Float32 = 3.14159f32
    let e = 2.718f64
    println("π ≈ ${pi}")
    println("e ≈ ${e}")

    // 十六进制浮点字面量
    let hexFloat = 0x1.1p0   // 1.0625
    println("十六进制浮点 0x1.1p0 = ${hexFloat}")

    // 浮点运算
    let avg = (72.5 + 81.0) / 2.0
    println("平均成绩: ${avg}")
}