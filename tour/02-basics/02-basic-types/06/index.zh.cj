main() {
    // Unit 类型：println 返回 Unit
    let result: Unit = println("println 返回 Unit 类型")
    println("Unit 的值: ${result}")

    // 赋值表达式的类型也是 Unit
    var x = 10
    // let u: Unit = (x = 20)  // 赋值表达式返回 Unit

    // Nothing 用于 return、break 等
    // 这些表达式之后的代码不会执行
    for (i in 0..3) {
        if (i == 2) {
            println("遇到 break，循环终止")
            break  // break 的类型是 Nothing
        }
        println("i = ${i}")
    }
}
