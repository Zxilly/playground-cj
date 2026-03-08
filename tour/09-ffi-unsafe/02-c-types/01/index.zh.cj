foreign func malloc(size: UIntNative): CPointer<Unit>
foreign func free(ptr: CPointer<Unit>): Unit

main() {
    // 创建空指针并检查。
    let p1 = CPointer<Int32>()
    println("p1 is null: ${p1.isNull()}")

    // 为一个 Int32 分配内存（4 字节）。
    let raw = unsafe { malloc(4) }
    var p2 = unsafe { CPointer<Int32>(raw) }

    // 通过指针写入和读取。
    unsafe { p2.write(42) }
    let value = unsafe { p2.read() }
    println("Value: ${value}")

    unsafe { free(raw) }
}
