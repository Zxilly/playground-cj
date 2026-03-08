// 方式 1：foreign 函数自动成为 CFunc。
foreign func abs(x: Int32): Int32

// 方式 2：@C 注解的仓颉函数。
@C
func doubleIt(x: Int32): Int32 {
    return x * 2
}

// 方式 3：CFunc 类型的 lambda（不能捕获变量）。
let negate: CFunc<(Int32) -> Int32> = { x: Int32 => -x }

main() {
    unsafe {
        println("abs(-5) = ${abs(-5)}")
        println("doubleIt(7) = ${doubleIt(7)}")
        println("negate(3) = ${negate(3)}")
    }
}
