main() {
    // while 循环：计算 1 到 10 的和
    var i = 1
    var sum = 0
    while (i <= 10) {
        sum += i
        i++
    }
    println("1 到 10 的和: ${sum}")
    
    // do-while 循环：至少执行一次
    var n = 100
    var count = 0
    do {
        println("do-while 循环执行第 ${count + 1} 次")
        count++
    } while (n < 10)  // 条件为假，但循环体仍会执行一次
    
    // 典型应用：不断除以 2 直到为 0
    var num = 100
    var divisions = 0
    while (num > 0) {
        num /= 2
        divisions++
    }
    println("100 需要除以 2 共 ${divisions} 次才能变为 0")
}