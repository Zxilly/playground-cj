// Declare C standard library functions
// Compile command: cjc main.cj -lc -o main
foreign func abs(x: Int32): Int32
foreign func rand(): Int32
foreign func srand(seed: UInt32): Unit

main() {
    // Set random seed for reproducible results
    unsafe { srand(42) }

    // Call abs function
    let a = unsafe { abs(-99) }
    println("abs(-99) = ${a}")

    // Verify abs behavior on positive numbers
    let b = unsafe { abs(42) }
    println("abs(42) = ${b}")

    // Call rand function multiple times
    let r1 = unsafe { rand() }
    let r2 = unsafe { rand() }
    println("rand() first call: ${r1}")
    println("rand() second call: ${r2}")

    // abs(rand()) is always non-negative
    let check = unsafe { abs(rand()) >= 0 }
    println("abs(rand()) >= 0: ${check}")

    // Boundary value test
    let minInt = unsafe { abs(-2147483648) }  // Int32 minimum value
    println("abs(Int32.MIN) = ${minInt}")
}