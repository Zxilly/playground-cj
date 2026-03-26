main() {
    let number = 15

    // 模式守卫：匹配后添加条件判断
    match (number) {
        case n where n < 0 => println("${n} 是负数")
        case n where n == 0 => println("零")
        case n where n % 2 == 0 => println("${n} 是正偶数")
        case n => println("${n} 是正奇数")
    }

    // 实际应用：成绩评级
    let score = 82
    let grade = match (score) {
        case s where s >= 90 => "A (优秀)"
        case s where s >= 80 => "B (良好)"
        case s where s >= 70 => "C (中等)"
        case s where s >= 60 => "D (及格)"
        case _ => "F (不及格)"
    }
    println("分数 ${score} => ${grade}")

    // 结合值模式使用守卫
    let temp = 25
    match (temp) {
        case t where t < 0 => println("冰冻")
        case t where t < 15 => println("寒冷")
        case t where t < 25 => println("凉爽")
        case t where t == 25 => println("舒适")
        case t => println("炎热")
    }
}