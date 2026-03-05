main() {
    let grade = "B"

    // 匹配字符串字面量
    match (grade) {
        case "A" => println("优秀")
        case "B" => println("良好")
        case "C" => println("及格")
        case _ => println("其他")
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
}
