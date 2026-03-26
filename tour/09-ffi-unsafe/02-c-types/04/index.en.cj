// Declare a foreign function that accepts a pointer (simulating a C function).
foreign func increment(ptr: CPointer<Int32>): Unit

// A Cangjie function defined with @C, which can also accept pointers.
@C
func swapTwo(a: CPointer<Int32>, b: CPointer<Int32>): Unit {
    // Read both values.
    let valA = unsafe { a.read() }
    let valB = unsafe { b.read() }
    // Swap and write.
    unsafe { a.write(valB) }
    unsafe { b.write(valA) }
}

// Another @C function example: calculate the sum of two numbers and return via pointer.
@C
func addAndStore(x: Int32, y: Int32, result: CPointer<Int32>): Unit {
    unsafe { result.write(x + y) }
}

// Define a struct to demonstrate inout with struct members.
struct Data {
    var value: Int32 = 0
    var count: Int32 = 0
}

main() {
    // inout example with local variable.
    var n: Int32 = 10
    println("Before call: n = ${n}")
    unsafe { increment(inout n) }
    println("After call: n = ${n}")

    // inout example with multiple parameters.
    var a: Int32 = 100
    var b: Int32 = 200
    println("Before swap: a = ${a}, b = ${b}")
    unsafe { swapTwo(inout a, inout b) }
    println("After swap: a = ${a}, b = ${b}")

    // Calculate and store result.
    var result: Int32 = 0
    unsafe { addAndStore(15, 27, inout result) }
    println("15 + 27 = ${result}")

    // inout example with struct members.
    var data = Data()
    println("Data initial: value = ${data.value}, count = ${data.count}")
    unsafe {
        increment(inout data.value)   // Modify value
        increment(inout data.count)   // Modify count
    }
    println("Data modified: value = ${data.value}, count = ${data.count}")
}