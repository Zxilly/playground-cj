import std.math.sqrt
import std.math.PI

main() {
    // 使用导入的 sqrt 函数计算平方根
    let a = 16
    let root = sqrt(Float64(a))
    println("${a} 的平方根是 ${root}")
    
    // 使用导入的 PI 常量
    let radius = 5.0
    let area = PI * radius * radius
    println("半径为 ${radius} 的圆面积是 ${area}")
    
    // 计算圆的周长
    let circumference = 2 * PI * radius
    println("周长是 ${circumference}")
    
    // 另一个平方根计算
    let b = 64
    let rootB = sqrt(Float64(b))
    println("${b} 的平方根是 ${rootB}")
}