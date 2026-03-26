// 声明 C 标准库函数
// 编译命令：cjc main.cj -lc -o main
foreign func abs(x: Int32): Int32
foreign func rand(): Int32
foreign func srand(seed: UInt32): Unit

main() {
    // 设置随机种子以获得可重复结果
    unsafe { srand(42) }

    // 调用 abs 函数
    let a = unsafe { abs(-99) }
    println("abs(-99) = ${a}")

    // 验证 abs 对正数的行为
    let b = unsafe { abs(42) }
    println("abs(42) = ${b}")

    // 调用 rand 函数多次
    let r1 = unsafe { rand() }
    let r2 = unsafe { rand() }
    println("rand() 第一次调用: ${r1}")
    println("rand() 第二次调用: ${r2}")

    // abs(rand()) 总是非负的
    let check = unsafe { abs(rand()) >= 0 }
    println("abs(rand()) >= 0: ${check}")

    // 边界值测试
    let minInt = unsafe { abs(-2147483648) }  // Int32 最小值
    println("abs(Int32.MIN) = ${minInt}")
}