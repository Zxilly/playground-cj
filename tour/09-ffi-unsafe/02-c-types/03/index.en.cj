// Way 1: A foreign function is automatically a CFunc.
foreign func abs(x: Int32): Int32

// Way 2: A @C-annotated Cangjie function.
@C
func doubleIt(x: Int32): Int32 {
    return x * 2
}

// Way 3: A CFunc-typed lambda (cannot capture variables).
let negate: CFunc<(Int32) -> Int32> = { x: Int32 => -x }

main() {
    unsafe {
        println("abs(-5) = ${abs(-5)}")
        println("doubleIt(7) = ${doubleIt(7)}")
        println("negate(3) = ${negate(3)}")
    }
}
