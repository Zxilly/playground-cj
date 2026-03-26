main() {
    // 默认浮点类型是 Float64
    let distance = 5.5
    let time = 2.0
    let speed = distance / time

    println("距离: ${distance} km")
    println("时间: ${time} h")
    println("平均速度: ${speed} km/h")

    // 科学计数法（十进制）
    let large = 2.5e10      // 2.5 × 10^10
    let small = 1.2e-5      // 1.2 × 10^-5
    let compact = .5e2      // 0.5 × 10^2 = 50.0
    println("大数: ${large}")
    println("小数: ${small}")
    println("紧凑写法: ${compact}")

    // 十六进制浮点数（p 表示指数，底数为 2）
    let hexFloat = 0x1.5p2  // (1 + 5/16) × 2^2 = 5.25
    let hexSimple = 0x1p3   // 1 × 2^3 = 8.0
    println("十六进制浮点: ${hexFloat}")
    println("简化式: ${hexSimple}")

    // 使用后缀指定类型
    let precise = 3.14159265358979f64
    let compact32 = 3.14f32
    let half = 1.5f16
    println("双精度: ${precise}")
    println("单精度: ${compact32}")
    println("半精度: ${half}")

    // 实际应用
    let price = 99.9
    let quantity = 3
    println("总价: ${price * Float64(quantity)}")
}