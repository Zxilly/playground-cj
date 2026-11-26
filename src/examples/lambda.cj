package playground

// 示例场景：使用高阶函数与 Lambda 表达式计算离散动力系统迭代序列
// 涉及特性：函数类型参数、单行与多行 Lambda 表达式
func iter(n: Int64, x0: Float64, f: (Float64) -> Float64) {
    var x = x0
    for (_ in 0..n) {
        print("${x}, ")
        x = f(x)
    }
    println("${x}")
}

main() {
    iter(5, 0.8, { x: Float64 => 1.0 / (1.0 - x)})
    iter(10, 0.8, { x: Float64 =>
        4.0 * x * (1.0 - x)
    })
}
