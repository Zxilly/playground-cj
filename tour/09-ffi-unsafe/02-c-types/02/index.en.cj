// Declare C standard library functions.
foreign func strlen(s: CString): UIntNative

main() {
    // Convert Cangjie String to CString.
    // mallocCString allocates memory on the C heap, requiring manual deallocation.
    var s1 = unsafe { LibC.mallocCString("Hello, FFI!") }
    var s2 = unsafe { LibC.mallocCString("world") }

    // Use CString member functions.
    println("s1 length: ${s1.size()}")
    println("Is s2 empty: ${s2.isEmpty()}")
    println("Does s1 start with 'Hello': ${s1.startsWith(unsafe { LibC.mallocCString("Hello") })}")

    // Compare two CStrings.
    let cmp = s1.compare(s2)
    if (cmp < 0) {
        println("s1 < s2")
    } else if (cmp > 0) {
        println("s1 > s2")
    } else {
        println("s1 == s2")
    }

    // Pass CString to C function.
    let len = unsafe { strlen(s1) }
    println("strlen(s1) = ${len}")

    // Convert CString back to Cangjie String.
    let str: String = s1.toString()
    println("Convert back to String: ${str}")

    // Must manually free the memory occupied by CString.
    unsafe {
        LibC.free(s1)
        LibC.free(s2)
    }
    println("CString memory freed")
}