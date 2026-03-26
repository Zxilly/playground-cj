// Declare C memory management functions
foreign func malloc(size: UIntNative): CPointer<Unit>
foreign func free(ptr: CPointer<Unit>): Unit

// Safe encapsulation: allocate an Int64, write value, read it back
// Returns None if allocation fails
func safeAlloc(value: Int64): Option<Int64> {
    let raw = unsafe { malloc(8) }  // Allocate 8 bytes (Int64 size)
    
    // Check if allocation succeeded
    if (raw.isNull()) {
        return None
    }
    
    // Type cast to specific pointer
    var p = unsafe { CPointer<Int64>(raw) }
    
    // Write data
    unsafe { p.write(value) }
    
    // Read data
    let result = unsafe { p.read() }
    
    // Free memory
    unsafe { free(raw) }
    
    return result
}

// Another example: safely operate on an array
func safeArrayOp(): Option<Int64> {
    let count: UIntNative = 3
    let raw = unsafe { malloc(count * 8) }  // 3 Int64s
    
    if (raw.isNull()) {
        return None
    }
    
    var p = unsafe { CPointer<Int64>(raw) }
    
    // Write multiple values
    unsafe {
        p.write(100)
        (p + 1).write(200)
        (p + 2).write(300)
    }
    
    // Read the middle value
    let middle = unsafe { (p + 1).read() }
    
    // Free memory
    unsafe { free(raw) }
    
    return middle
}

main() {
    // unsafe details are encapsulated inside safeAlloc
    match (safeAlloc(42)) {
        case Some(v) => println("Safe allocation succeeded: Got ${v}")
        case None => println("Allocation failed: Insufficient memory")
    }
    
    // Test array operations
    match (safeArrayOp()) {
        case Some(v) => println("Middle array element: ${v}")
        case None => println("Array operation failed")
    }
    
    // Demonstrate null pointer check
    var nullPtr = CPointer<Int64>()
    println("Null pointer check: ${nullPtr.isNull()}")
    
    // Allocation failure case (allocating 0 bytes may return null in some implementations)
    let zeroAlloc = unsafe { malloc(0) }
    println("Zero-byte allocation is null: ${zeroAlloc.isNull()}")
    unsafe { free(zeroAlloc) }
}