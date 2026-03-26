// Declare C standard library functions.
foreign func malloc(size: UIntNative): CPointer<Unit>
foreign func free(ptr: CPointer<Unit>): Unit

// Define a struct for C interop.
@C
struct Point3D {
    var x: Int64
    var y: Int64
    var z: Int64
}

main() {
    // Create a null pointer.
    let p1 = CPointer<Point3D>()
    println("Is p1 null: ${p1.isNull()}")

    // Allocate 24 bytes on the heap (size of Point3D).
    let raw = unsafe { malloc(24) }
    
    // Convert CPointer<Unit> to CPointer<Point3D>.
    var p2 = unsafe { CPointer<Point3D>(raw) }
    println("Is p2 null: ${p2.isNull()}")

    // Write data through pointer.
    unsafe { p2.write(Point3D(x: 10, y: 20, z: 30)) }

    // Read data through pointer.
    let point = unsafe { p2.read() }
    println("Read point: (${point.x}, ${point.y}, ${point.z})")

    // Pointer arithmetic: offset to the next Point3D position.
    let p3: CPointer<Point3D> = unsafe { p2 + 1 }
    println("Pointer offset difference: ${p3.toUIntNative() - p2.toUIntNative()} bytes")

    // Free memory.
    unsafe { free(raw) }
    println("Memory freed")
}