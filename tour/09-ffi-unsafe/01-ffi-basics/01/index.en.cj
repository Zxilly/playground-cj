// Declare C standard library functions using `foreign`.
// The @C annotation is optional on foreign declarations.
foreign func rand(): Int32
foreign func abs(x: Int32): Int32

main() {
    // Foreign functions must be called inside an `unsafe` block.
    let r = unsafe { rand() }
    println("Random number: ${r}")

    let result = unsafe { abs(-42) }
    println("abs(-42) = ${result}")
}
