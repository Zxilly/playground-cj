main() {
    let isActive = true
    let isAdmin = false

    println("isActive: ${isActive}")
    println("isAdmin: ${isAdmin}")

    // 逻辑运算
    println("AND: ${isActive && isAdmin}")
    println("OR: ${isActive || isAdmin}")
    println("NOT: ${!isActive}")

    // 比较运算产生布尔值
    let x = 10
    let y = 20
    println("${x} > ${y}: ${x > y}")
    println("${x} < ${y}: ${x < y}")
    println("${x} == ${y}: ${x == y}")
}
