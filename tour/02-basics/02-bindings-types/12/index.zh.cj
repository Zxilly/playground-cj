main() {
    let x = 10
    let y = 20

    // 比较运算符
    println("${x} == ${y}: ${x == y}")
    println("${x} != ${y}: ${x != y}")
    println("${x} < ${y}: ${x < y}")
    println("${x} >= ${y}: ${x >= y}")

    // 逻辑运算符
    let a = true
    let b = false
    println("${a} && ${b} = ${a && b}")
    println("${a} || ${b} = ${a || b}")
    println("!${a} = ${!a}")

    // 组合使用
    let age = 25
    let hasLicense = true
    let canDrive = age >= 18 && hasLicense
    println("可以开车: ${canDrive}")
}
