foreign func malloc(size: UIntNative): CPointer<Unit>
foreign func free(ptr: CPointer<Unit>): Unit

main() {
    // Create a null pointer and check it.
    let p1 = CPointer<Int32>()
    println("p1 is null: ${p1.isNull()}")

    // Allocate memory for one Int32 (4 bytes).
    let raw = unsafe { malloc(4) }
    var p2 = unsafe { CPointer<Int32>(raw) }

    // Write and read through the pointer.
    unsafe { p2.write(42) }
    let value = unsafe { p2.read() }
    println("Value: ${value}")

    unsafe { free(raw) }
}
