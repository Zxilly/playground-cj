// 声明 C 标准库函数。
// 编译命令：cjc main.cj -lc -o main
foreign func abs(x: Int32): Int32
foreign func rand(): Int32

main() {
    unsafe {
        let a = abs(-99)
        println("abs(-99) = ${a}")

        let r = rand()
        println("rand() = ${r}")

        // abs() 总是返回非负值。
        let check = abs(r) >= 0
        println("abs(rand()) >= 0: ${check}")
    }
}
