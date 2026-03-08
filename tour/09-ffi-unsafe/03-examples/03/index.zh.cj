foreign func malloc(size: UIntNative): CPointer<Unit>
foreign func free(ptr: CPointer<Unit>): Unit

// 安全封装：分配一个 Int64，写入值，读取回来。
// 如果分配失败则返回 None。
func safeAlloc(value: Int64): Option<Int64> {
    let raw = unsafe { malloc(8) }
    if (raw.isNull()) {
        return None
    }
    var p = unsafe { CPointer<Int64>(raw) }
    unsafe { p.write(value) }
    let result = unsafe { p.read() }
    unsafe { free(raw) }
    return result
}

main() {
    // unsafe 细节被封装在 safeAlloc 内部。
    match (safeAlloc(42)) {
        case Some(v) => println("Got: ${v}")
        case None => println("Allocation failed")
    }
}
