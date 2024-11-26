// 示例场景：蒙特卡洛算法求圆周率
// 涉及特性：常量，变量，可变性，类型转换，幂运算符
import std.random.*
import std.math.*

main() {
    // 常量定义是为编译期数据命名，可用于常量表达式中
    const N = 100000u32
    // 变量定义是为运行时数据存储单元命名，以便后续程序引用
    // 如果需要对这份存储单元进行读/写，可使用 var 定义可变变量
    var n: UInt32 = 0 // 可以显式指定变量的类型
    let random = Random() // 如果省略类型标注，则以初值表达式的类型确定变量类型
    for (_ in 0..N) {
        // 如果对这份存储单元只读不写，可使用 let 定义不可变变量
        let x = random.nextFloat64()
        // 不可变变量的初值在运行时确定，这是它和常量的最大区别
        let y = random.nextFloat64()
        // 读取不可变变量的值
        if ((x - 0.5) ** 2 + (y - 0.5) ** 2 < 0.25) {
            n++ // 修改可变变量的值
        }
    }
    let pi = Float64(n) / Float64(N) * 4.0
    println("π ≈ ${pi}")
    println("deviation: ${abs(Float64.PI - pi)}")
}
