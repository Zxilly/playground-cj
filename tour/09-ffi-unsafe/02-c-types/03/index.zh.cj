// 方式 1：foreign 函数自动成为 CFunc。
// foreign 声明的函数在 C 侧定义，仓颉侧只有声明。
foreign func abs(x: Int32): Int32

// 方式 2：@C 注解的仓颉函数。
// 这使得函数可以被 C 代码调用，同时也是 CFunc 类型。
@C
func doubleIt(x: Int32): Int32 {
    return x * 2
}

// 方式 3：CFunc 类型的 lambda。
// 注意：不能捕获任何外部变量（闭包捕获）。
let negate: CFunc<(Int32) -> Int32> = { x: Int32 => -x }

// 另一个 CFunc lambda 示例。
let square: CFunc<(Int32) -> Int32> = { x: Int32 => x * x }

// 将 CFunc 作为参数使用的示例。
foreign func atexit(cb: CFunc<() -> Unit>): Int32

main() {
    // 所有 CFunc 的调用都必须在 unsafe 块中。
    unsafe {
        // 调用 foreign 函数。
        println("abs(-5) = ${abs(-5)}")
        println("abs(42) = ${abs(42)}")

        // 调用 @C 修饰的函数。
        println("doubleIt(7) = ${doubleIt(7)}")
        println("doubleIt(-3) = ${doubleIt(-3)}")

        // 调用 CFunc 类型的 lambda。
        println("negate(10) = ${negate(10)}")
        println("negate(-8) = ${negate(-8)}")
        
        // 调用另一个 CFunc lambda。
        println("square(4) = ${square(4)}")

        // 将 CFunc 作为值传递。
        let funcs: Array<CFunc<(Int32) -> Int32>> = [abs, doubleIt, negate, square]
        for (f in funcs) {
            println("函数应用于 3: ${f(3)}")
        }
    }
}