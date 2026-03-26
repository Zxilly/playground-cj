// 声明 C 标准库函数。
foreign func strlen(s: CString): UIntNative

main() {
    // 将仓颉 String 转换为 CString。
    // mallocCString 在 C 堆上分配内存，需要手动释放。
    var s1 = unsafe { LibC.mallocCString("Hello, FFI!") }
    var s2 = unsafe { LibC.mallocCString("world") }

    // 使用 CString 的成员函数。
    println("s1 长度: ${s1.size()}")
    println("s2 是否为空: ${s2.isEmpty()}")
    println("s1 是否以 'Hello' 开头: ${s1.startsWith(unsafe { LibC.mallocCString("Hello") })}")

    // 比较两个 CString。
    let cmp = s1.compare(s2)
    if (cmp < 0) {
        println("s1 < s2")
    } else if (cmp > 0) {
        println("s1 > s2")
    } else {
        println("s1 == s2")
    }

    // 将 CString 传递给 C 函数。
    let len = unsafe { strlen(s1) }
    println("strlen(s1) = ${len}")

    // 将 CString 转换回仓颉 String。
    let str: String = s1.toString()
    println("转换回 String: ${str}")

    // 必须手动释放 CString 占用的内存。
    unsafe {
        LibC.free(s1)
        LibC.free(s2)
    }
    println("CString 内存已释放")
}