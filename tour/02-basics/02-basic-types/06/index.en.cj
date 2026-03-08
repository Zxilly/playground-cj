main() {
    // Unit type: println returns Unit
    let result: Unit = println("println 返回 Unit 类型")
    println("Unit 的值: ${result}")

    // Assignment expressions also have type Unit
    var x = 10
    // let u: Unit = (x = 20)  // assignment expression returns Unit

    // Nothing is the type of break, return, etc.
    // Code after these expressions does not execute
    for (i in 0..3) {
        if (i == 2) {
            println("遇到 break，循环终止")
            break  // break has type Nothing
        }
        println("i = ${i}")
    }
}
