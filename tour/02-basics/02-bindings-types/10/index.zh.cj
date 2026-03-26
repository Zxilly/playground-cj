main() {
    // Unit 类型：println 返回 Unit
    let result: Unit = println("println 返回 Unit 类型")
    println("Unit 的值: ${result}")
    println("Unit 的字面量: ${()}")

    // 赋值表达式也返回 Unit
    var x = 10
    let assignment: Unit = (x = 20)
    println("赋值后 x = ${x}")
    println("赋值表达式类型: ${assignment}")

    // 循环表达式返回 Unit
    var count = 0
    let loopResult = while (count < 3) {
        println("循环中: ${count}")
        count = count + 1
    }
    println("循环结束，循环体类型: ${loopResult}")

    // Nothing 类型用于控制流
    // break、continue、return、throw 的类型都是 Nothing
    var i = 0
    while (i < 5) {
        if (i == 3) {
            println("遇到 break，循环终止")
            break  // break 的类型是 Nothing
            // 这行代码永远不会执行
            // println("break 之后")
        }
        println("i = ${i}")
        i = i + 1
    }

    println("程序继续执行")

    // Unit 类型只支持赋值、判等和判不等
    let a: Unit = ()
    let b: Unit = ()
    println("() == (): ${a == b}")
    println("() != (): ${a != b}")
}