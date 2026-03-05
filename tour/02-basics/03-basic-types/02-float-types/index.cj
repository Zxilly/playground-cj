main() {
    let pi: Float64 = 3.14159265358979
    let e: Float64 = 2.71828

    // 科学计数法
    let speed = 3.0e8       // 光速: 3 × 10^8
    let tiny = 1.6e-19      // 电子电荷

    println("pi = ${pi}")
    println("e = ${e}")
    println("光速 = ${speed}")
    println("电子电荷 = ${tiny}")

    // 浮点运算
    let radius = 5.0
    let area = pi * radius * radius
    println("半径 ${radius} 的圆面积 = ${area}")
}
