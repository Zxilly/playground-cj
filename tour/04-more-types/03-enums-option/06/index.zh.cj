// 描述 Option 的内容
func describeOption(opt: Option<Int64>): String {
    match (opt) {
        case Some(v) => "包含值: ${v}"
        case None => "空值"
    }
}

// 根据名字查找分数
func findGrade(name: String): Option<Int64> {
    match (name) {
        case "Alice" => Some(95)
        case "Bob" => Some(82)
        case "Carol" => Some(91)
        case _ => None
    }
}

// 将分数转换为字母等级（使用守卫）
func getLetterGrade(score: Option<Int64>): String {
    match (score) {
        case Some(s) where s >= 90 => "A"
        case Some(s) where s >= 80 => "B"
        case Some(s) where s >= 70 => "C"
        case Some(_) => "F"
        case None => "N/A"
    }
}

main() {
    // 测试描述函数
    println(describeOption(Some(42)))
    println(describeOption(None))
    println()

    // 查找并显示多个学生的成绩
    let names = ["Alice", "Bob", "Dave", "Carol"]
    for (name in names) {
        let grade = findGrade(name)
        let letter = getLetterGrade(grade)

        match (grade) {
            case Some(score) =>
                println("${name}: ${score} 分 (${letter})")
            case None =>
                println("${name}: 未找到成绩记录")
        }
    }
}