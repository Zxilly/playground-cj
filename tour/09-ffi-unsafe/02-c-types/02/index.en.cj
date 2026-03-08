foreign func strlen(s: CString): UIntNative

main() {
    // Convert a Cangjie String to CString (allocates C heap memory).
    var cs = unsafe { LibC.mallocCString("Hello, FFI!") }

    // Use CString methods.
    println("Is empty: ${cs.isEmpty()}")
    println("Size: ${cs.size()}")

    // Pass CString to a C function.
    let len = unsafe { strlen(cs) }
    println("strlen: ${len}")

    // Convert back to Cangjie String.
    let s: String = cs.toString()
    println("Back to String: ${s}")

    // Always free CString when done.
    unsafe { LibC.free(cs) }
}
