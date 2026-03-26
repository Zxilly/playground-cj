main() {
    let isActive = true
    let isAdmin = false

    println("isActive: ${isActive}")
    println("isAdmin: ${isAdmin}")

    // 逻辑非
    let notActive = !isActive
    println("NOT isActive: ${notActive}")

    // 逻辑与（两者都为真才为真）
    let canEdit = isActive && isAdmin
    println("AND isActive && isAdmin: ${canEdit}")

    // 逻辑或（有一个为真即为真）
    let canView = isActive || isAdmin
    println("OR isActive || isAdmin: ${canView}")

    // 比较运算产生布尔值
    let x = 10
    let y = 20
    println("${x} > ${y}: ${x > y}")
    println("${x} < ${y}: ${x < y}")
    println("${x} == ${y}: ${x == y}")
    println("${x} != ${y}: ${x != y}")
    println("${x} >= ${y}: ${x >= y}")
    println("${x} <= ${y}: ${x <= y}")

    // 组合逻辑表达式
    let hasPermission = isActive && (isAdmin || x > 5)
    println("复杂条件: ${hasPermission}")

    // 短路求值示例
    let a = false
    let result = a && (10 / 0 == 1)  // 不会除零，因为 a 已经是 false
    println("短路求值结果: ${result}")
}