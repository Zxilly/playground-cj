// 声明一个接受指针的 foreign 函数（模拟 C 函数）。
foreign func increment(ptr: CPointer<Int32>): Unit

// 使用 @C 定义的仓颉函数，它也可以接受指针。
@C
func swapTwo(a: CPointer<Int32>, b: CPointer<Int32>): Unit {
    // 读取两个值。
    let valA = unsafe { a.read() }
    let valB = unsafe { b.read() }
    // 交换写入。
    unsafe { a.write(valB) }
    unsafe { b.write(valA) }
}

// 另一个 @C 函数示例：计算两数之和并通过指针返回。
@C
func addAndStore(x: Int32, y: Int32, result: CPointer<Int32>): Unit {
    unsafe { result.write(x + y) }
}

// 定义一个结构体，演示 inout 用于 struct 成员。
struct Data {
    var value: Int32 = 0
    var count: Int32 = 0
}

main() {
    // 局部变量的 inout 示例。
    var n: Int32 = 10
    println("调用前: n = ${n}")
    unsafe { increment(inout n) }
    println("调用后: n = ${n}")

    // 多个参数的 inout 示例。
    var a: Int32 = 100
    var b: Int32 = 200
    println("交换前: a = ${a}, b = ${b}")
    unsafe { swapTwo(inout a, inout b) }
    println("交换后: a = ${a}, b = ${b}")

    // 计算并存储结果。
    var result: Int32 = 0
    unsafe { addAndStore(15, 27, inout result) }
    println("15 + 27 = ${result}")

    // struct 成员的 inout 示例。
    var data = Data()
    println("Data 初始: value = ${data.value}, count = ${data.count}")
    unsafe {
        increment(inout data.value)   // 修改 value
        increment(inout data.count)   // 修改 count
    }
    println("Data 修改后: value = ${data.value}, count = ${data.count}")
}