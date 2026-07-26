import std.math.*

main() {
    // 使用导入的 sqrt 函数计算平方根
    let a = 16
    let root = sqrt(Float64(a))
    println("${a} 的平方根是 ${root}")
    
    // 使用 math 包为 Float64 提供的圆周率
    let pi = Float64.getPI()
    let radius = 5.0
    let area = pi * radius * radius
    println("半径为 ${radius} 的圆面积是 ${area}")
    
    // 计算圆的周长
    let circumference = 2.0 * pi * radius
    println("周长是 ${circumference}")
    
    // 另一个平方根计算
    let b = 64
    let rootB = sqrt(Float64(b))
    println("${b} 的平方根是 ${rootB}")
}
