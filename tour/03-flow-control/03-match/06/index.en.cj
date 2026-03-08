main() {
    let number = 15

    match (number) {
        case n where n < 0 => println("${n} 是负数")
        case n where n == 0 => println("零")
        case n where n % 2 == 0 => println("${n} 是正偶数")
        case n => println("${n} 是正奇数")
    }

    // Practical example: grade classification
    let score = 82
    let grade = match (score) {
        case s where s >= 90 => "A"
        case s where s >= 80 => "B"
        case s where s >= 70 => "C"
        case s where s >= 60 => "D"
        case _ => "F"
    }
    println("分数 ${score} => 等级 ${grade}")
}
