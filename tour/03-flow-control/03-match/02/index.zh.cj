main() {
    let grade = "B"

    // 匹配字符串字面量
    match (grade) {
        case "A" => println("优秀")
        case "B" => println("良好")
        case "C" => println("及格")
        case _ => println("其他等级")
    }

    // 使用 | 匹配多个值
    let month = 8
    let season = match (month) {
        case 3 | 4 | 5 => "春季"
        case 6 | 7 | 8 => "夏季"
        case 9 | 10 | 11 => "秋季"
        case 12 | 1 | 2 => "冬季"
        case _ => "无效月份"
    }
    println("${month}月是${season}")

    // 多值匹配也可以用于布尔值和其他类型
    let isWeekend = true
    match (isWeekend) {
        case true => println("可以休息了！")
        case false => println("继续努力工作")
    }
}