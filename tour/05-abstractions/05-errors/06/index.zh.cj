import std.math.*

// TODO: 将此函数改为返回 Option<Float64>
// 除数为 0 时返回 None，否则返回 Some(结果)
func divide(a: Float64, b: Float64): Option<Float64> {
    // 在此实现
    None
}

// TODO: 使用 ?? 操作符，在 divide 返回 None 时返回 0.0
func safeDivide(a: Float64, b: Float64): Float64 {
    // 在此实现
    0.0
}

main() {
    // 测试 divide 函数
    println("divide(10.0, 2.0) = ${divide(10.0, 2.0)}")
    println("divide(10.0, 0.0) = ${divide(10.0, 0.0)}")

    // 测试 safeDivide 函数
    println("safeDivide(10.0, 2.0) = ${safeDivide(10.0, 2.0)}")
    println("safeDivide(10.0, 0.0) = ${safeDivide(10.0, 0.0)}")

    // 期望输出：
    // divide(10.0, 2.0) = Some(5.000000)
    // divide(10.0, 0.0) = None
    // safeDivide(10.0, 2.0) = 5.000000
    // safeDivide(10.0, 0.0) = 0.000000
}