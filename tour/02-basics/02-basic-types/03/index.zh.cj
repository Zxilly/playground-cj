main() {
    // 布尔字面量
    let isActive = true
    let isAdmin = false
    println("活跃用户: ${isActive}")
    println("管理员: ${isAdmin}")

    // 逻辑非操作
    println("NOT true = ${!isActive}")
    println("NOT false = ${!isAdmin}")

    // 逻辑与和或
    println("true && false = ${isActive && isAdmin}")
    println("true || false = ${isActive || isAdmin}")

    // 短路求值演示
    func getValue(): Bool {
        println("  getValue() 被调用了")
        true
    }
    
    println("短路求值示例:")
    let r1 = false && getValue()  // getValue 不会被调用
    println("false && getValue() 后 getValue 未被调用")
    
    let r2 = true || getValue()   // getValue 不会被调用
    println("true || getValue() 后 getValue 未被调用")

    // 比较操作产生布尔值
    let x = 10
    let y = 20
    println("${x} > ${y}: ${x > y}")
    println("${x} < ${y}: ${x < y}")
    println("${x} == ${y}: ${x == y}")
    println("${x} != ${y}: ${x != y}")
}