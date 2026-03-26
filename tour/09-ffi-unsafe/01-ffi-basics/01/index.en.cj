// Declare C standard library functions using foreign
// @C annotation can be omitted on foreign declarations
foreign func rand(): Int32
foreign func abs(x: Int32): Int32
foreign func srand(seed: UInt32): Unit

main() {
    // foreign functions must be called in unsafe blocks
    // Set random seed for predictable random sequence
    unsafe { srand(42) }
    
    let r1 = unsafe { rand() }
    let r2 = unsafe { rand() }
    println("First random number: ${r1}")
    println("Second random number: ${r2}")
    
    // Call C standard library absolute value function
    let negative = -123
    let absolute = unsafe { abs(negative) }
    println("abs(${negative}) = ${absolute}")
    
    // Set the same seed again, observe if random sequence repeats
    unsafe { srand(42) }
    let r3 = unsafe { rand() }
    println("Random number after resetting seed: ${r3} (should be same as first)")
}