// 一个接受 CPointer<Int32> 的 @C 函数——模拟 C 函数
// 通过指针修改值的行为。
@C
func increment(ptr: CPointer<Int32>): Unit {
    let current = unsafe { ptr.read() }
    unsafe { ptr.write(current + 1) }
}

main() {
    var n: Int32 = 10
    println("Before: ${n}")

    // `inout n` 将 &n 作为 CPointer<Int32> 传递给 C 函数。
    unsafe { increment(inout n) }
    println("After: ${n}")
}
