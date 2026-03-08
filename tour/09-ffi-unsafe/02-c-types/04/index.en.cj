// A @C function that takes a CPointer<Int32> — simulating a C function
// that modifies a value through a pointer.
@C
func increment(ptr: CPointer<Int32>): Unit {
    let current = unsafe { ptr.read() }
    unsafe { ptr.write(current + 1) }
}

main() {
    var n: Int32 = 10
    println("Before: ${n}")

    // `inout n` passes &n as CPointer<Int32> to the C function.
    unsafe { increment(inout n) }
    println("After: ${n}")
}
