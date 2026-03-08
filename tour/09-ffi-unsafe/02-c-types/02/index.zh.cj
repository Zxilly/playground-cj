foreign func strlen(s: CString): UIntNative

main() {
    // 将仓颉 String 转换为 CString（在 C 堆上分配内存）。
    var cs = unsafe { LibC.mallocCString("Hello, FFI!") }

    // 使用 CString 的方法。
    println("Is empty: ${cs.isEmpty()}")
    println("Size: ${cs.size()}")

    // 将 CString 传递给 C 函数。
    let len = unsafe { strlen(cs) }
    println("strlen: ${len}")

    // 转换回仓颉 String。
    let s: String = cs.toString()
    println("Back to String: ${s}")

    // 使用完毕后必须释放 CString。
    unsafe { LibC.free(cs) }
}
