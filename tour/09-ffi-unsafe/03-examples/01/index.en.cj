// Declare C standard library functions.
// Compile with: cjc main.cj -lc -o main
foreign func abs(x: Int32): Int32
foreign func rand(): Int32

main() {
    unsafe {
        let a = abs(-99)
        println("abs(-99) = ${a}")

        let r = rand()
        println("rand() = ${r}")

        // abs() always returns a non-negative value.
        let check = abs(r) >= 0
        println("abs(rand()) >= 0: ${check}")
    }
}
