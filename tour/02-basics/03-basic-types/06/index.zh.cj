main() {
    // Unit 类型：println 返回 Unit
    let result: Unit = println("println 的返回值是 Unit")
    println("Unit 的值: ${result}")
    
    // Unit 的唯一值是 ()
    let empty: Unit = ()
    println("空值: ${empty}")
    
    // 赋值表达式的类型也是 Unit
    var x = 10
    let assignResult = (x = 20)
    println("赋值后 x = ${x}")
    println("赋值表达式的结果: ${assignResult}")

    // Nothing 类型用于控制流
    // break、continue、return 的类型是 Nothing
    println("开始循环")
    for (i in 0..5) {
        if (i == 3) {
            println("遇到 i=3，执行 break")
            break  // break 的类型是 Nothing
            // break 之后的代码不会执行
            println("这行不会打印")
        }
        println("i = ${i}")
    }
    println("循环结束")

    // Nothing 是所有类型的子类型，可以用于灵活的类型推断
    func assertPositive(n: Int64): Unit {
        if (n < 0) {
            throw IllegalArgumentException("n 必须为正数")
            // throw 的类型是 Nothing，因此函数返回 Unit
        }
        println("${n} 是正数")
    }
    
    assertPositive(42)
}