foreign func malloc(size: UIntNative): CPointer<Unit>
foreign func free(ptr: CPointer<Unit>): Unit

// Safe wrapper: allocates an Int64, writes a value, reads it back.
// Returns None if allocation fails.
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
    // The unsafe details are hidden inside safeAlloc.
    match (safeAlloc(42)) {
        case Some(v) => println("Got: ${v}")
        case None => println("Allocation failed")
    }
}
