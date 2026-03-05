main() {
    let a = 17
    let b = 5

    println("${a} + ${b} = ${a + b}")
    println("${a} - ${b} = ${a - b}")
    println("${a} * ${b} = ${a * b}")
    println("${a} / ${b} = ${a / b}")   // 整数除法，结果为 3
    println("${a} % ${b} = ${a % b}")

    // 幂运算
    let base = 2.0
    println("${base} ** 10 = ${base ** 10}")

    // 自增自减
    var count = 0
    count++
    println("count++ => ${count}")
    count--
    println("count-- => ${count}")
}
