// Method 1: foreign functions automatically become CFunc.
// foreign declared functions are defined on the C side, with only declarations on the Cangjie side.
foreign func abs(x: Int32): Int32

// Method 2: @C annotated Cangjie function.
// This makes the function callable from C code, and it's also a CFunc type.
@C
func doubleIt(x: Int32): Int32 {
    return x * 2
}

// Method 3: CFunc type lambda.
// Note: Cannot capture any external variables (closure capture).
let negate: CFunc<(Int32) -> Int32> = { x: Int32 => -x }

// Another CFunc lambda example.
let square: CFunc<(Int32) -> Int32> = { x: Int32 => x * x }

// Example of using CFunc as a parameter.
foreign func atexit(cb: CFunc<() -> Unit>): Int32

main() {
    // All CFunc calls must be in unsafe blocks.
    unsafe {
        // Call foreign function.
        println("abs(-5) = ${abs(-5)}")
        println("abs(42) = ${abs(42)}")

        // Call @C annotated function.
        println("doubleIt(7) = ${doubleIt(7)}")
        println("doubleIt(-3) = ${doubleIt(-3)}")

        // Call CFunc type lambda.
        println("negate(10) = ${negate(10)}")
        println("negate(-8) = ${negate(-8)}")
        
        // Call another CFunc lambda.
        println("square(4) = ${square(4)}")

        // Pass CFunc as a value.
        let funcs: Array<CFunc<(Int32) -> Int32>> = [abs, doubleIt, negate, square]
        for (f in funcs) {
            println("Function applied to 3: ${f(3)}")
        }
    }
}