main() {
    let day = 3

    let name = match (day) {
        case 1 => "星期一"
        case 2 => "星期二"
        case 3 => "星期三"
        case 4 => "星期四"
        case 5 => "星期五"
        case 6 => "星期六"
        case 7 => "星期日"
        case _ => "无效日期"
    }
    println("今天是${name}")

    // match 也可以不赋值，直接执行
    match (day) {
        case 6 | 7 => println("周末休息")
        case _ => println("工作日加油")
    }
}
